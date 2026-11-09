package config

import "testing"

func TestLoadPrefersDedicatedPort(t *testing.T) {
	t.Setenv("PORT", "5001")
	t.Setenv("TRAEFIK_LOG_DASHBOARD_PORT", "6001")

	cfg := Load()
	if cfg.Port != "6001" {
		t.Fatalf("expected dedicated port 6001, got %s", cfg.Port)
	}
}

func TestLoadFallsBackToPort(t *testing.T) {
	t.Setenv("PORT", "5001")
	t.Setenv("TRAEFIK_LOG_DASHBOARD_PORT", "")

	cfg := Load()
	if cfg.Port != "5001" {
		t.Fatalf("expected PORT fallback 5001, got %s", cfg.Port)
	}
}
