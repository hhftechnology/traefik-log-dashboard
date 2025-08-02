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
)

func main() {
	// Load environment variables
	godotenv.Load()

	// Initialize log parser
	logParser = NewLogParser()

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
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
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
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	client := NewWebSocketClient(conn, logParser)
	go client.WritePump()
	go client.ReadPump()
}