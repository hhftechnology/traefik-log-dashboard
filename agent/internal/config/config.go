// Package config handles configuration loading from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
	"github.com/joho/godotenv"
)

// Config holds the application configuration
type Config struct {
	// Server configuration
	Port string

	// Log paths
	AccessPath string
	ErrorPath  string

	// Authentication
	AuthToken string

	// System monitoring
	SystemMonitoring bool
	MonitorInterval  int

	// Log parsing
	LogFormat string

	// Streaming / batching
	StreamBatchLines       int
	StreamFlushIntervalMS  int
	StreamMaxClients       int
	StreamMaxDurationSec   int
	StreamMaxBytesPerBatch int

	// State persistence
	PositionFile string

	// Rate limiting
	RateLimitRPM int
}

// Load reads configuration from environment variables.
// It will attempt to load a .env file if present.
func Load() *Config {
	// Load .env file if present (optional)
	if err := godotenv.Load(); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			logger.Log.Println("No .env file found, using system environment variables")
		} else {
			logger.Log.Printf("Warning: error loading .env file: %v", err)
		}
	}

	return &Config{
		Port:                   getEnv("TRAEFIK_LOG_DASHBOARD_PORT", getEnv("PORT", "5000")),
		AccessPath:             getEnv("TRAEFIK_LOG_DASHBOARD_ACCESS_PATH", "/var/log/traefik/access.log"),
		ErrorPath:              getEnv("TRAEFIK_LOG_DASHBOARD_ERROR_PATH", "/var/log/traefik/traefik.log"),
		AuthToken:              getEnv("TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN", ""),
		SystemMonitoring:       getEnvBool("TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING", true),
		MonitorInterval:        getEnvInt("TRAEFIK_LOG_DASHBOARD_MONITOR_INTERVAL", 2000),
		LogFormat:              getEnv("TRAEFIK_LOG_DASHBOARD_LOG_FORMAT", "json"),
		StreamBatchLines:       getEnvInt("TRAEFIK_LOG_DASHBOARD_STREAM_BATCH_LINES", 400),
		StreamFlushIntervalMS:  getEnvInt("TRAEFIK_LOG_DASHBOARD_STREAM_FLUSH_INTERVAL_MS", 500),
		StreamMaxClients:       getEnvInt("TRAEFIK_LOG_DASHBOARD_STREAM_MAX_CLIENTS", 50),
		StreamMaxDurationSec:   getEnvInt("TRAEFIK_LOG_DASHBOARD_STREAM_MAX_DURATION_SEC", 300),
		StreamMaxBytesPerBatch: getEnvInt("TRAEFIK_LOG_DASHBOARD_STREAM_MAX_BYTES_PER_BATCH", 512*1024),
		PositionFile:           getEnv("POSITION_FILE", "/data/.position"),
		RateLimitRPM:           getEnvInt("RATE_LIMIT_RPM", 300),
	}
}

// getEnv retrieves an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvBool retrieves a boolean environment variable or returns a default value
func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value == "true" || value == "1" || value == "yes"
}

// getEnvInt retrieves an integer environment variable or returns a default value
func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	result, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return result
}

// Validate checks that the configuration has valid values.
func (c *Config) Validate() error {
	if c.StreamBatchLines <= 0 {
		return fmt.Errorf("StreamBatchLines must be > 0, got %d", c.StreamBatchLines)
	}
	if c.StreamFlushIntervalMS <= 0 {
		return fmt.Errorf("StreamFlushIntervalMS must be > 0, got %d", c.StreamFlushIntervalMS)
	}
	if c.StreamMaxClients <= 0 {
		return fmt.Errorf("StreamMaxClients must be > 0, got %d", c.StreamMaxClients)
	}
	if c.StreamMaxDurationSec <= 0 {
		return fmt.Errorf("StreamMaxDurationSec must be > 0, got %d", c.StreamMaxDurationSec)
	}
	if c.MonitorInterval <= 0 {
		return fmt.Errorf("MonitorInterval must be > 0, got %d", c.MonitorInterval)
	}
	if c.RateLimitRPM < 0 {
		return fmt.Errorf("RateLimitRPM must be >= 0, got %d", c.RateLimitRPM)
	}
	return nil
}
