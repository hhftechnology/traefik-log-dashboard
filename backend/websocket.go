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
	statsInterval := time.NewTicker(5 * time.Second)
	geoStatsInterval := time.NewTicker(10 * time.Second)
	
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
			c.sendNewLog(log)

		case <-statsInterval.C:
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
		},
	})
}

func (c *WebSocketClient) sendNewLog(log LogEntry) {
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

	c.sendMessage(WebSocketMessage{
		Type: "newLog",
		Data: log,
	})
}