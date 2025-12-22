package config

import (
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/env"
)

// Config holds the application configuration
type Config struct {
	AccessPath       string
	ErrorPath        string
	AuthToken        string
	SystemMonitoring bool
	MonitorInterval  int
	Address          string
	Port             string
	LogFormat        string
	GeoIPEnabled     bool
	GeoIPCityDB      string
	GeoIPCountryDB   string
	PositionFile     string
}

// Load reads configuration from environment variables using the env package
func Load() *Config {
	e := env.LoadEnv()

	cfg := &Config{
		AccessPath:       e.AccessPath,
		ErrorPath:        e.ErrorPath,
		AuthToken:        e.AuthToken,
		SystemMonitoring: e.SystemMonitoring,
		MonitorInterval:  2000, // Keep default for now
		Address:          e.Address,
		Port:             e.Port,
		LogFormat:        e.LogFormat,
		GeoIPEnabled:     e.GeoIPEnabled,
		GeoIPCityDB:      e.GeoIPCityDB,
		GeoIPCountryDB:   e.GeoIPCountryDB,
		PositionFile:     e.PositionFile,
	}

	return cfg
}