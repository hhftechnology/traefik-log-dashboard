package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

type WebSocketMessage struct {
	Type   string      `json:"type"`
	Data   interface{} `json:"data,omitempty"`
	Params interface{} `json:"params,omitempty"`
	Stats  *Stats      `json:"stats,omitempty"`  // Add stats field for bundled updates
}

// NewLogWithStats represents a new log entry bundled with current stats
type NewLogWithStats struct {
	Log   LogEntry `json:"log"`
	Stats Stats    `json:"stats"`
}

type WebSocketClient struct {
	conn      *websocket.Conn
	send      chan []byte
	logParser *LogParser
	logChan   chan LogEntry
}

func NewWebSocketClient(conn *websocket.Conn, logParser *LogParser) *WebSocketClient {
	return &WebSocketClient{
		conn:      conn,
		send:      make(chan []byte, 256),
		logParser: logParser,
		logChan:   make(chan LogEntry, 100),
	}
}

func (c *WebSocketClient) ReadPump() {
	defer func() {
		c.logParser.RemoveListener(c.logChan)
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg WebSocketMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling WebSocket message: %v", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *WebSocketClient) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	// Reduce stats interval since we're now sending stats with each log
	statsInterval := time.NewTicker(10 * time.Second)
	geoStatsInterval := time.NewTicker(15 * time.Second)
	
	defer func() {
		ticker.Stop()
		statsInterval.Stop()
		geoStatsInterval.Stop()
		c.conn.Close()
	}()

	// Send initial data
	c.sendInitialData()

	// Subscribe to new logs
	c.logParser.AddListener(c.logChan)

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case log := <-c.logChan:
			c.sendNewLogWithStats(log)

		case <-statsInterval.C:
			// Send standalone stats update (less frequent now)
			c.sendStats()

		case <-geoStatsInterval.C:
			c.sendGeoStats()
			c.sendGeoProcessingStatus()

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *WebSocketClient) sendInitialData() {
	// Send initial stats
	c.sendStats()

	// Send recent logs
	result := c.logParser.GetLogs(LogsParams{Page: 1, Limit: 50})
	c.sendMessage(WebSocketMessage{
		Type: "logs",
		Data: result.Logs,
	})

	// Send initial geo stats
	c.sendGeoStats()
}

func (c *WebSocketClient) handleMessage(msg WebSocketMessage) {
	switch msg.Type {
	case "getLogs":
		params := LogsParams{Page: 1, Limit: 50}
		if msg.Params != nil {
			if p, err := json.Marshal(msg.Params); err == nil {
				json.Unmarshal(p, &params)
			}
		}
		result := c.logParser.GetLogs(params)
		c.sendMessage(WebSocketMessage{
			Type: "logs",
			Data: result,
		})

	case "getStats":
		c.sendStats()

	case "getGeoStats":
		c.sendGeoStats()
		
	case "refreshGeoData":
		// Handle explicit geo data refresh requests
		log.Println("Received geo data refresh request from client")
		c.sendGeoStats()
		c.sendStats()
	}
}

func (c *WebSocketClient) sendMessage(msg WebSocketMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling WebSocket message: %v", err)
		return
	}

	select {
	case c.send <- data:
	default:
		log.Println("WebSocket send channel full, dropping message")
	}
}

func (c *WebSocketClient) sendStats() {
	stats := c.logParser.GetStats()
	c.sendMessage(WebSocketMessage{
		Type: "stats",
		Data: stats,
	})
}

func (c *WebSocketClient) sendGeoStats() {
	geoStats := c.logParser.GetGeoStats()
	c.sendMessage(WebSocketMessage{
		Type: "geoStats",
		Data: geoStats,
	})
}

func (c *WebSocketClient) sendGeoProcessingStatus() {
	stats := c.logParser.GetStats()
	cacheStats := GetGeoCacheStats()

	c.sendMessage(WebSocketMessage{
		Type: "geoProcessingStatus",
		Data: map[string]interface{}{
			"geoProcessingRemaining": stats.GeoProcessingRemaining,
			"cachedLocations":        cacheStats.Keys,
			"totalCountries":         len(stats.Countries),
			"isProcessing":           c.logParser.IsProcessingGeo(),
			"maxmindConfig":          cacheStats.MaxMindConfig,
		},
	})
}

// Updated function to send new log with current stats
func (c *WebSocketClient) sendNewLogWithStats(log LogEntry) {
	// Check if this is a clear signal
	if log.ID == "CLEAR" {
		c.sendMessage(WebSocketMessage{
			Type: "clear",
			Data: nil,
		})
		// Also send fresh stats and logs after clear
		c.sendStats()
		result := c.logParser.GetLogs(LogsParams{Page: 1, Limit: 50})
		c.sendMessage(WebSocketMessage{
			Type: "logs",
			Data: result.Logs,
		})
		return
	}

	// Get current stats - this will include the impact of the new log
	// since stats are updated in parseLine before notifying listeners
	currentStats := c.logParser.GetStats()

	// Send new log message with bundled stats for real-time updates
	c.sendMessage(WebSocketMessage{
		Type:  "newLog",
		Data:  log,
		Stats: &currentStats,  // Include current stats with the log
	})
}

// Keep the old function for backward compatibility, but mark as deprecated
func (c *WebSocketClient) sendNewLog(log LogEntry) {
	// This function is now deprecated in favor of sendNewLogWithStats
	// Redirect to the new function
	c.sendNewLogWithStats(log)
}

// New method to force refresh geo data (called from main.go broadcast)
func (c *WebSocketClient) ForceGeoRefresh() {
	log.Println("Forcing geo data refresh for WebSocket client")
	c.sendGeoStats()
	c.sendStats()
	
	// Send a special message to trigger immediate map update on frontend
	c.sendMessage(WebSocketMessage{
		Type: "geoDataUpdated",
		Data: map[string]interface{}{
			"message": "MaxMind database updated, geo data refreshed",
			"timestamp": time.Now().Unix(),
		},
	})
}