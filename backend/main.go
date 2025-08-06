package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var (
	logParser *LogParser
	otlpReceiver *OTLPReceiver
	upgrader  = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow connections from any origin
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
	wsClients    = make(map[*WebSocketClient]bool)
	wsClientsMux = sync.RWMutex{}
	healthTicker *time.Ticker
	healthStop   chan struct{}
)

func main() {
	// Load environment variables
	godotenv.Load()

	// Initialize log parser
	logParser = NewLogParser()

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutdown signal received, cleaning up...")
		cancel()
		cleanup()
		os.Exit(0)
	}()

	// Start WebSocket health monitoring
	startWebSocketHealthMonitor()

	// Setup Gin router
	r := gin.Default()

	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// API Routes
	r.GET("/api/stats", getStats)
	r.GET("/api/logs", getLogs)
	r.GET("/api/services", getServices)
	r.GET("/api/routers", getRouters)
	r.GET("/api/geo-stats", getGeoStats)
	r.GET("/api/geo-processing-status", getGeoProcessingStatus)
	r.POST("/api/set-log-file", setLogFile)
	r.POST("/api/set-log-files", setLogFiles)
	
	// MaxMind API Routes
	r.GET("/api/maxmind/config", getMaxMindConfig)
	r.POST("/api/maxmind/reload", reloadMaxMindDatabase)
	r.POST("/api/maxmind/test", testMaxMindDatabase)
	
	// WebSocket status endpoint for debugging
	r.GET("/api/websocket/status", getWebSocketStatus)
	
	// Health check with WebSocket status
	r.GET("/health", healthCheck)

	// WebSocket endpoint
	r.GET("/ws", handleWebSocket)

	// Start watching log files from environment variable
	logFile := os.Getenv("TRAEFIK_LOG_FILE")
	if logFile == "" {
		logFile = "/logs/traefik.log"
	}

	// Check if multiple log files are specified
	if strings.Contains(logFile, ",") {
		logFiles := strings.Split(logFile, ",")
		for i := range logFiles {
			logFiles[i] = strings.TrimSpace(logFiles[i])
		}
		go logParser.SetLogFiles(logFiles)
	} else {
		go logParser.SetLogFiles([]string{logFile})
	}

	// Start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Server running on port %s", port)
	log.Printf("MaxMind configuration: %+v", GetMaxMindConfig())
	log.Printf("WebSocket clients tracking enabled")
	
	// Start server with graceful shutdown
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server:", err)
		}
	}()

	// Wait for shutdown signal
	<-ctx.Done()
	
	// Shutdown server with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
}

func cleanup() {
	log.Println("Starting cleanup...")
	
	// Stop health monitor
	if healthStop != nil {
		close(healthStop)
	}
	
	// Stop log parser
	if logParser != nil {
		logParser.Stop()
	}
	
	// Close all WebSocket connections
	wsClientsMux.Lock()
	for client := range wsClients {
		client.Close()
	}
	wsClients = make(map[*WebSocketClient]bool)
	wsClientsMux.Unlock()
	
	// Stop geo retry processor
	StopRetryProcessor()
	
	// Close MaxMind database
	CloseMaxMindDatabase()
	
	log.Println("Cleanup completed")
}

// WebSocket Client Management Functions
func addWSClient(client *WebSocketClient) {
	wsClientsMux.Lock()
	defer wsClientsMux.Unlock()
	wsClients[client] = true
	log.Printf("[WebSocket] Total clients connected: %d", len(wsClients))
}

func removeWSClient(client *WebSocketClient) {
	wsClientsMux.Lock()
	defer wsClientsMux.Unlock()
	delete(wsClients, client)
	log.Printf("[WebSocket] Client removed. Total clients: %d", len(wsClients))
}

func getWSClientCount() int {
	wsClientsMux.RLock()
	defer wsClientsMux.RUnlock()
	return len(wsClients)
}

func getWSClientInfo() []map[string]interface{} {
	wsClientsMux.RLock()
	defer wsClientsMux.RUnlock()
	
	var clients []map[string]interface{}
	for client := range wsClients {
		if client.IsHealthy() {
			clients = append(clients, client.GetInfo())
		}
	}
	return clients
}

// Broadcast geo updates to all connected clients
func broadcastGeoUpdate() {
	wsClientsMux.RLock()
	clientList := make([]*WebSocketClient, 0, len(wsClients))
	for client := range wsClients {
		if client.IsHealthy() {
			clientList = append(clientList, client)
		}
	}
	wsClientsMux.RUnlock()
	
	for _, client := range clientList {
		client.ForceGeoRefresh()
	}
	
	log.Printf("[WebSocket] Broadcasted geo updates to %d connected clients", len(clientList))
}

// Start periodic WebSocket health monitoring
func startWebSocketHealthMonitor() {
	healthStop = make(chan struct{})
	healthTicker = time.NewTicker(30 * time.Second)
	
	go func() {
		for {
			select {
			case <-healthTicker.C:
				wsClientsMux.RLock()
				unhealthyClients := make([]*WebSocketClient, 0)
				totalClients := len(wsClients)
				
				for client := range wsClients {
					if !client.IsHealthy() {
						unhealthyClients = append(unhealthyClients, client)
					}
				}
				wsClientsMux.RUnlock()
				
				// Remove unhealthy clients
				if len(unhealthyClients) > 0 {
					wsClientsMux.Lock()
					for _, client := range unhealthyClients {
						delete(wsClients, client)
						client.Close()
					}
					wsClientsMux.Unlock()
					
					log.Printf("[WebSocket] Health check: removed %d unhealthy clients, %d remaining", 
						len(unhealthyClients), totalClients-len(unhealthyClients))
				}
				
				if totalClients > 0 && len(unhealthyClients) == 0 {
					log.Printf("[WebSocket] Health check: %d clients healthy", totalClients)
				}
			case <-healthStop:
				healthTicker.Stop()
				return
			}
		}
	}()
}

// Enhanced trigger immediate geo processing with better client notification
func triggerImmediateGeoProcessing() {
	log.Println("[GeoLocation] Triggering immediate geo processing for existing IPs...")
	
	// Get current stats to find top IPs that might need re-processing
	stats := logParser.GetStats()
	
	// Re-process top IPs immediately with the new MaxMind database
	var ipsToProcess []string
	for _, ipData := range stats.TopIPs {
		if ipData.IP != "unknown" && !isPrivateIPCheck(ipData.IP) {
			ipsToProcess = append(ipsToProcess, ipData.IP)
		}
		// Limit to top 20 IPs to avoid overwhelming the system
		if len(ipsToProcess) >= 20 {
			break
		}
	}
	
	// Process these IPs immediately in a goroutine
	go func() {
		processedCount := 0
		for _, ip := range ipsToProcess {
			// Clear any cached data for this IP first
			ClearGeoCache()
			
			// Get fresh geo data with new MaxMind database
			geoData := GetGeoLocation(ip)
			if geoData != nil {
				processedCount++
				log.Printf("[GeoLocation] Re-processed IP %s: %s, %s", ip, geoData.Country, geoData.City)
			}
		}
		
		if processedCount > 0 {
			log.Printf("[GeoLocation] Completed immediate geo processing for %d IPs", processedCount)
			// Broadcast updates to all connected clients
			broadcastGeoUpdate()
		}
	}()
}

// Helper function to check private IPs (duplicate of the one in logParser but needed here)
func isPrivateIPCheck(ip string) bool {
	if ip == "" || ip == "unknown" {
		return true
	}

	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return false
	}

	return ip == "127.0.0.1" ||
		ip == "localhost" ||
		strings.HasPrefix(ip, "::") ||
		ip == "::1" ||
		parts[0] == "10" ||
		(parts[0] == "172" && isInRangeCheck(parts[1], 16, 31)) ||
		(parts[0] == "192" && parts[1] == "168") ||
		(parts[0] == "169" && parts[1] == "254")
}

func isInRangeCheck(s string, min, max int) bool {
	var n int
	if _, err := fmt.Sscanf(s, "%d", &n); err != nil {
		return false
	}
	return n >= min && n <= max
}

// API Route Handlers
func getStats(c *gin.Context) {
	stats := logParser.GetStats()
	c.JSON(http.StatusOK, stats)
}

func getLogs(c *gin.Context) {
	params := LogsParams{
		Page:  1,
		Limit: 100,
	}

	if p := c.Query("page"); p != "" {
		var page int
		if _, err := fmt.Sscanf(p, "%d", &page); err == nil {
			params.Page = page
		}
	}

	if l := c.Query("limit"); l != "" {
		var limit int
		if _, err := fmt.Sscanf(l, "%d", &limit); err == nil {
			params.Limit = limit
		}
	}

	params.Filters.Service = c.Query("service")
	params.Filters.Status = c.Query("status")
	params.Filters.Router = c.Query("router")
	params.Filters.HideUnknown = c.Query("hideUnknown") == "true"
	params.Filters.HidePrivateIPs = c.Query("hidePrivateIPs") == "true"

	result := logParser.GetLogs(params)
	c.JSON(http.StatusOK, result)
}

func getServices(c *gin.Context) {
	services := logParser.GetServices()
	c.JSON(http.StatusOK, services)
}

func getRouters(c *gin.Context) {
	routers := logParser.GetRouters()
	c.JSON(http.StatusOK, routers)
}

func getGeoStats(c *gin.Context) {
	stats := logParser.GetGeoStats()
	c.JSON(http.StatusOK, stats)
}

func getGeoProcessingStatus(c *gin.Context) {
	stats := logParser.GetStats()
	cacheStats := GetGeoCacheStats()

	c.JSON(http.StatusOK, gin.H{
		"geoProcessingRemaining": stats.GeoProcessingRemaining,
		"cachedLocations":        cacheStats.Keys,
		"cacheStats":             cacheStats.Stats,
		"retryQueueLength":       cacheStats.RetryQueueLength,
		"totalCountries":         len(stats.Countries),
		"isProcessing":           logParser.IsProcessingGeo(),
		"maxmindConfig":          cacheStats.MaxMindConfig,
	})
}

func getMaxMindConfig(c *gin.Context) {
	config := GetMaxMindConfig()
	c.JSON(http.StatusOK, config)
}

func reloadMaxMindDatabase(c *gin.Context) {
	if err := ReloadMaxMindDatabase(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Clear geo cache to ensure fresh lookups
	ClearGeoCache()

	// Trigger immediate geo processing for existing IPs
	triggerImmediateGeoProcessing()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "MaxMind database reloaded successfully, immediate geo processing initiated",
		"config":  GetMaxMindConfig(),
	})
}

func testMaxMindDatabase(c *gin.Context) {
	var req struct {
		TestIP string `json:"testIP"`
	}

	// Set default test IP if none provided
	req.TestIP = "8.8.8.8"
	
	if err := c.ShouldBindJSON(&req); err != nil {
		// Use default IP if JSON parsing fails
		req.TestIP = "8.8.8.8"
	}

	if req.TestIP == "" {
		req.TestIP = "8.8.8.8"
	}

	// Test the geolocation
	geoData := GetGeoLocation(req.TestIP)
	
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"testIP":    req.TestIP,
		"geoData":   geoData,
		"config":    GetMaxMindConfig(),
	})
}

func setLogFile(c *gin.Context) {
	var req struct {
		FilePath string `json:"filePath"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := logParser.SetLogFiles([]string{req.FilePath}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Log file set successfully",
	})
}

func setLogFiles(c *gin.Context) {
	var req struct {
		FilePaths []string `json:"filePaths"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := logParser.SetLogFiles(req.FilePaths); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Log files set successfully",
	})
}

func getWebSocketStatus(c *gin.Context) {
	status := gin.H{
		"connectedClients": getWSClientCount(),
		"clients":          getWSClientInfo(),
		"upgrader": gin.H{
			"readBufferSize":  upgrader.ReadBufferSize,
			"writeBufferSize": upgrader.WriteBufferSize,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
	
	c.JSON(http.StatusOK, status)
}

func healthCheck(c *gin.Context) {
	config := GetMaxMindConfig()
	
	health := gin.H{
		"status": "ok",
		"timestamp": time.Now().Format(time.RFC3339),
		"websocket": gin.H{
			"connectedClients": getWSClientCount(),
			"upgraderConfig": gin.H{
				"readBufferSize":  upgrader.ReadBufferSize,
				"writeBufferSize": upgrader.WriteBufferSize,
			},
		},
		"maxmind": gin.H{
			"enabled":        config.Enabled,
			"databaseLoaded": config.DatabaseLoaded,
		},
		"logParser": gin.H{
			"totalLogs":       len(logParser.logs),
			"isProcessingGeo": logParser.IsProcessingGeo(),
		},
	}
	
	if config.DatabaseError != "" {
		health["maxmind"].(gin.H)["error"] = config.DatabaseError
	}
	
	c.JSON(http.StatusOK, health)
}

// Enhanced WebSocket handler with better error handling and logging
func handleWebSocket(c *gin.Context) {
	log.Printf("[WebSocket] New connection attempt from %s", c.ClientIP())
	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade error from %s: %v", c.ClientIP(), err)
		return
	}

	client := NewWebSocketClient(conn, logParser)
	addWSClient(client)
	
	// Start client goroutines
	client.Start()
	
	log.Printf("[WebSocket] Client setup complete for %s", c.ClientIP())
}