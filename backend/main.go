package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var (
	logParser *LogParser
	upgrader  = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow connections from any origin
		},
	}
	wsClients = make(map[*WebSocketClient]bool) // Track WebSocket clients
)

func main() {
	// Load environment variables
	godotenv.Load()

	// Initialize log parser
	logParser = NewLogParser()

	// Setup graceful shutdown for MaxMind database
	defer CloseMaxMindDatabase()

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
	
	// Health check
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
	
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// Add client tracking functions
func addWSClient(client *WebSocketClient) {
	wsClients[client] = true
}

func removeWSClient(client *WebSocketClient) {
	delete(wsClients, client)
}

// Broadcast geo updates to all connected clients
func broadcastGeoUpdate() {
	for client := range wsClients {
		// Use the new ForceGeoRefresh method for immediate updates
		client.ForceGeoRefresh()
	}
	
	log.Printf("Broadcasted geo updates to %d connected clients", len(wsClients))
}

// Trigger immediate geo processing for existing IPs
func triggerImmediateGeoProcessing() {
	log.Println("Triggering immediate geo processing for existing IPs...")
	
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
				log.Printf("Re-processed IP %s: %s, %s", ip, geoData.Country, geoData.City)
			}
		}
		
		if processedCount > 0 {
			log.Printf("Completed immediate geo processing for %d IPs", processedCount)
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

func healthCheck(c *gin.Context) {
	config := GetMaxMindConfig()
	
	health := gin.H{
		"status":    "ok",
		"maxmind": gin.H{
			"enabled":        config.Enabled,
			"databaseLoaded": config.DatabaseLoaded,
		},
	}
	
	if config.DatabaseError != "" {
		health["maxmind"].(gin.H)["error"] = config.DatabaseError
	}
	
	c.JSON(http.StatusOK, health)
}

func handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	client := NewWebSocketClient(conn, logParser)
	addWSClient(client) // Track the client
	
	go client.WritePump()
	go func() {
		client.ReadPump()
		removeWSClient(client) // Remove client when connection closes
	}()
}