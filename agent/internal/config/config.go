// Package config handles configuration loading from environment variables.
package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
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

	// State persistence
	PositionFile string
}

// Load reads configuration from environment variables.
// It will attempt to load a .env file if present.
func Load() *Config {
	// Load .env file if present (optional)
	if err := godotenv.Load(); err != nil {
		logger.Log.Println("No .env file found, using system environment variables")
	}

	return &Config{
		Port:             getEnv("PORT", "5000"),
		AccessPath:       getEnv("TRAEFIK_LOG_DASHBOARD_ACCESS_PATH", "/var/log/traefik/access.log"),
		ErrorPath:        getEnv("TRAEFIK_LOG_DASHBOARD_ERROR_PATH", "/var/log/traefik/traefik.log"),
		AuthToken:        getEnv("TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN", ""),
		SystemMonitoring: getEnvBool("TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING", true),
		MonitorInterval:  getEnvInt("TRAEFIK_LOG_DASHBOARD_MONITOR_INTERVAL", 2000),
		LogFormat:        getEnv("TRAEFIK_LOG_DASHBOARD_LOG_FORMAT", "json"),
		PositionFile:     getEnv("POSITION_FILE", "/data/.position"),
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
