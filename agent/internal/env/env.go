package env

import (
	"os"

	"github.com/joho/godotenv"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

// Env holds environment variables for the agent
type Env struct {
	Address          string
	Port             string
	AccessPath       string
	ErrorPath        string
	SystemMonitoring bool
	AuthToken        string
	LogFormat        string
	GeoIPEnabled     bool
	GeoIPCityDB      string
	GeoIPCountryDB   string
	PositionFile     string
}

// LoadEnv loads environment variables from .env file if present
// and returns an Env struct with all configuration
func LoadEnv() Env {
	// Load .env file if present
	if err := godotenv.Load(); err != nil {
		logger.Log.Println("No .env file found, using system environment variables")
	}

	return Env{
		Address:          getEnv("ADDRESS", "[::]"),
		Port:             getEnv("PORT", "5000"),
		AccessPath:       getEnv("TRAEFIK_LOG_DASHBOARD_ACCESS_PATH", "/var/log/traefik/access.log"),
		ErrorPath:        getEnv("TRAEFIK_LOG_DASHBOARD_ERROR_PATH", "/var/log/traefik/traefik.log"),
		SystemMonitoring: getEnvBool("TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING", true),
		AuthToken:        getEnv("TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN", ""),
		LogFormat:        getEnv("TRAEFIK_LOG_DASHBOARD_LOG_FORMAT", "json"),
		GeoIPEnabled:     getEnvBool("TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED", true),
		GeoIPCityDB:      getEnv("TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB", "GeoLite2-City.mmdb"),
		GeoIPCountryDB:   getEnv("TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB", "GeoLite2-Country.mmdb"),
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