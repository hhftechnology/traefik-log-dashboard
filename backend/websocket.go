package main

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WebSocketMessage struct {
	Type   string      `json:"type"`
	Data   interface{} `json:"data,omitempty"`
	Params interface{} `json:"params,omitempty"`
	Stats  *Stats      `json:"stats,omitempty"`
}

type WebSocketClient struct {
	conn       *websocket.Conn
	send       chan []byte
	logParser  *LogParser
	logChan    chan LogEntry
	clientID   string
	closeChan  chan struct{}
	closeOnce  sync.Once
	mu         sync.Mutex
	lastPing   time.Time
	isClosing  bool
}

func NewWebSocketClient(conn *websocket.Conn, logParser *LogParser) *WebSocketClient {
	clientID := time.Now().Format("20060102-150405") + "-" + conn.RemoteAddr().String()
	log.Printf("[WebSocket] New client connected: %s", clientID)
	
	return &WebSocketClient{
		conn:      conn,
		send:      make(chan []byte, 256),
		logParser: logParser,
		logChan:   make(chan LogEntry, 100),
		clientID:  clientID,
		closeChan: make(chan struct{}),
		lastPing:  time.Now(),
	}
}

func (c *WebSocketClient) Start() {
	// Start goroutines with proper cleanup
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[WebSocket] WritePump panic recovered: %v", r)
			}
			removeWSClient(c)
			c.Close()
		}()
		c.WritePump()
	}()
	
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[WebSocket] ReadPump panic recovered: %v", r)
			}
			removeWSClient(c)
			c.Close()
		}()
		c.ReadPump()
	}()
}

func (c *WebSocketClient) Close() {
	c.closeOnce.Do(func() {
		log.Printf("[WebSocket] Closing client %s", c.clientID)
		
		c.mu.Lock()
		c.isClosing = true
		c.mu.Unlock()
		
		close(c.closeChan)
		c.logParser.RemoveListener(c.logChan)
		
		// Close send channel
		close(c.send)
		
		// Close WebSocket connection
		c.conn.Close()
	})
}

func (c *WebSocketClient) ReadPump() {
	defer c.Close()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.mu.Lock()
		c.lastPing = time.Now()
		c.mu.Unlock()
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		select {
		case <-c.closeChan:
			return
		default:
			_, message, err := c.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("[WebSocket] Client %s error: %v", c.clientID, err)
				}
				return
			}

			var msg WebSocketMessage
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Printf("[WebSocket] Client %s message parse error: %v", c.clientID, err)
				continue
			}

			log.Printf("[WebSocket] Client %s sent message type: %s", c.clientID, msg.Type)
			c.handleMessage(msg)
		}
	}
}

func (c *WebSocketClient) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	statsInterval := time.NewTicker(10 * time.Second)
	geoStatsInterval := time.NewTicker(15 * time.Second)
	
	defer func() {
		ticker.Stop()
		statsInterval.Stop()
		geoStatsInterval.Stop()
		c.Close()
	}()

	// Send initial data
	log.Printf("[WebSocket] Sending initial data to client %s", c.clientID)
	c.sendInitialData()

	// Subscribe to new logs
	c.logParser.AddListener(c.logChan)
	log.Printf("[WebSocket] Client %s subscribed to log updates", c.clientID)

	messageCount := 0
	for {
		select {
		case <-c.closeChan:
			return
			
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("[WebSocket] Client %s write error: %v", c.clientID, err)
				return
			}
			
			messageCount++
			if messageCount%100 == 0 {
				log.Printf("[WebSocket] Client %s sent %d messages", c.clientID, messageCount)
			}

			// Drain send channel to prevent blocking (batch send)
			n := len(c.send)
			for i := 0; i < n; i++ {
				select {
				case msg := <-c.send:
					if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
						return
					}
					messageCount++
				default:
					break
				}
			}

		case logEntry := <-c.logChan:
			select {
			case <-c.closeChan:
				return
			default:
				if logEntry.ID == "CLEAR" {
					log.Printf("[WebSocket] Sending clear signal to client %s", c.clientID)
				}
				c.sendNewLogWithStats(logEntry)
			}

		case <-statsInterval.C:
			select {
			case <-c.closeChan:
				return
			default:
				c.sendStats()
			}

		case <-geoStatsInterval.C:
			select {
			case <-c.closeChan:
				return
			default:
				c.sendGeoStats()
				c.sendGeoProcessingStatus()
			}

		case <-ticker.C:
			select {
			case <-c.closeChan:
				return
			default:
				c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					log.Printf("[WebSocket] Client %s ping error: %v", c.clientID, err)
					return
				}
			}
		}
	}
}

func (c *WebSocketClient) sendInitialData() {
	// Send initial stats
	log.Printf("[WebSocket] Sending initial stats to client %s", c.clientID)
	c.sendStats()

	// Send recent logs - INCREASED FROM 50 TO 1000
	result := c.logParser.GetLogs(LogsParams{Page: 1, Limit: 1000})
	log.Printf("[WebSocket] Sending %d initial logs to client %s", len(result.Logs), c.clientID)
	c.sendMessage(WebSocketMessage{
		Type: "logs",
		Data: result.Logs,
	})

	// Send initial geo stats
	c.sendGeoStats()
	c.sendGeoProcessingStatus()
}

func (c *WebSocketClient) handleMessage(msg WebSocketMessage) {
	log.Printf("[WebSocket] Client %s handling message: %s", c.clientID, msg.Type)
	
	switch msg.Type {
	case "getLogs":
		params := LogsParams{Page: 1, Limit: 1000} // INCREASED DEFAULT FROM 50 TO 1000
		if msg.Params != nil {
			if p, err := json.Marshal(msg.Params); err == nil {
				json.Unmarshal(p, &params)
			}
		}
		result := c.logParser.GetLogs(params)
		log.Printf("[WebSocket] Client %s requested logs, sending %d logs", c.clientID, len(result.Logs))
		c.sendMessage(WebSocketMessage{
			Type: "logs",
			Data: result,
		})

	case "getStats":
		log.Printf("[WebSocket] Client %s requested stats", c.clientID)
		c.sendStats()

	case "getGeoStats":
		log.Printf("[WebSocket] Client %s requested geo stats", c.clientID)
		c.sendGeoStats()
		
	case "refreshGeoData":
		log.Printf("[WebSocket] Client %s requested geo data refresh", c.clientID)
		c.sendGeoStats()
		c.sendStats()
		
	default:
		log.Printf("[WebSocket] Client %s sent unknown message type: %s", c.clientID, msg.Type)
	}
}

func (c *WebSocketClient) sendMessage(msg WebSocketMessage) {
	c.mu.Lock()
	if c.isClosing {
		c.mu.Unlock()
		return
	}
	c.mu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[WebSocket] Client %s marshal error: %v", c.clientID, err)
		return
	}

	select {
	case c.send <- data:
		// Message sent successfully
	case <-time.After(time.Second):
		log.Printf("[WebSocket] Client %s send timeout, dropping message type: %s", c.clientID, msg.Type)
	case <-c.closeChan:
		// Client is closing
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

func (c *WebSocketClient) sendNewLogWithStats(log LogEntry) {
	// Check if this is a clear signal
	if log.ID == "CLEAR" {
		c.sendMessage(WebSocketMessage{
			Type: "clear",
			Data: nil,
		})
		// Also send fresh stats and logs after clear
		c.sendStats()
		result := c.logParser.GetLogs(LogsParams{Page: 1, Limit: 1000}) // INCREASED FROM 50 TO 1000
		c.sendMessage(WebSocketMessage{
			Type: "logs",
			Data: result.Logs,
		})
		return
	}

	// Get current stats - this will include the impact of the new log
	currentStats := c.logParser.GetStats()

	// Send new log message with bundled stats for real-time updates
	c.sendMessage(WebSocketMessage{
		Type:  "newLog",
		Data:  log,
		Stats: &currentStats,
	})
}

// Enhanced method to force refresh geo data
func (c *WebSocketClient) ForceGeoRefresh() {
	log.Printf("[WebSocket] Forcing geo data refresh for client %s", c.clientID)
	c.sendGeoStats()
	c.sendStats()
	
	// Send a special message to trigger immediate map update on frontend
	c.sendMessage(WebSocketMessage{
		Type: "geoDataUpdated",
		Data: map[string]interface{}{
			"message":   "MaxMind database updated, geo data refreshed",
			"timestamp": time.Now().Unix(),
		},
	})
}

// Health check method to verify client is still active
func (c *WebSocketClient) IsHealthy() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if c.isClosing || c.conn == nil {
		return false
	}
	
	// Check if we've received a pong recently
	if time.Since(c.lastPing) > 90*time.Second {
		return false
	}
	
	return true
}

// Get client info for debugging
func (c *WebSocketClient) GetInfo() map[string]interface{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	return map[string]interface{}{
		"clientID":    c.clientID,
		"remoteAddr":  c.conn.RemoteAddr().String(),
		"sendChanLen": len(c.send),
		"logChanLen":  len(c.logChan),
		"lastPing":    c.lastPing.Format(time.RFC3339),
		"isClosing":   c.isClosing,
	}
}