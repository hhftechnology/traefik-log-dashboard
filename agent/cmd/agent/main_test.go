package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/auth"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/routes"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/state"
)

func TestRootEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"traefik-log-dashboard-agent","version":"1.0.0"}`))
	})

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]string
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%s'", response["status"])
	}

	if response["service"] != "traefik-log-dashboard-agent" {
		t.Errorf("Expected service 'traefik-log-dashboard-agent', got '%s'", response["service"])
	}
}

func TestStatusEndpoint(t *testing.T) {
	cfg := &config.Config{
		AccessPath:       "/tmp/test-access.log",
		ErrorPath:        "/tmp/test-error.log",
		AuthToken:        "",
		SystemMonitoring: true,
		MonitorInterval:  2000,
		Port:             "5000",
	}

	sm := state.NewStateManager(cfg)
	handler := routes.NewHandler(cfg, sm)
	req := httptest.NewRequest(http.MethodGet, "/api/logs/status", nil)
	w := httptest.NewRecorder()

	handler.HandleStatus(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%v'", response["status"])
	}
}

func TestAuthenticationMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		token          string
		authHeader     string
		expectedStatus int
	}{
		{
			name:           "Valid token",
			token:          "test-token",
			authHeader:     "Bearer test-token",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Invalid token",
			token:          "test-token",
			authHeader:     "Bearer wrong-token",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Missing auth header",
			token:          "test-token",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Invalid auth format",
			token:          "test-token",
			authHeader:     "Token test-token",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "No token configured",
			token:          "",
			authHeader:     "",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authenticator := auth.NewAuthenticator(tt.token)

			handler := authenticator.Middleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestCORSHeaders(t *testing.T) {
	cfg := &config.Config{
		AccessPath:       "/tmp/test-access.log",
		ErrorPath:        "/tmp/test-error.log",
		AuthToken:        "",
		SystemMonitoring: true,
		MonitorInterval:  2000,
		Port:             "5000",
	}

	sm := state.NewStateManager(cfg)
	handler := routes.NewHandler(cfg, sm)
	req := httptest.NewRequest(http.MethodOptions, "/api/logs/status", nil)
	w := httptest.NewRecorder()

	handler.HandleStatus(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("Expected CORS header not set")
	}
}

func TestSystemResourcesEndpoint(t *testing.T) {
	cfg := &config.Config{
		AccessPath:       "/tmp/test-access.log",
		ErrorPath:        "/tmp/test-error.log",
		AuthToken:        "",
		SystemMonitoring: true,
		MonitorInterval:  2000,
		Port:             "5000",
	}

	sm := state.NewStateManager(cfg)
	handler := routes.NewHandler(cfg, sm)
	req := httptest.NewRequest(http.MethodGet, "/api/system/resources", nil)
	w := httptest.NewRecorder()

	handler.HandleSystemResources(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Check if response contains expected fields
	if _, ok := response["cpu"]; !ok {
		t.Error("Expected 'cpu' field in response")
	}

	if _, ok := response["memory"]; !ok {
		t.Error("Expected 'memory' field in response")
	}

	if _, ok := response["disk"]; !ok {
		t.Error("Expected 'disk' field in response")
	}
}

func TestSystemResourcesDisabled(t *testing.T) {
	cfg := &config.Config{
		AccessPath:       "/tmp/test-access.log",
		ErrorPath:        "/tmp/test-error.log",
		AuthToken:        "",
		SystemMonitoring: false,
		MonitorInterval:  2000,
		Port:             "5000",
	}

	sm := state.NewStateManager(cfg)
	handler := routes.NewHandler(cfg, sm)
	req := httptest.NewRequest(http.MethodGet, "/api/system/resources", nil)
	w := httptest.NewRecorder()

	handler.HandleSystemResources(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestMain(m *testing.M) {
	// Setup: Create test log files
	os.WriteFile("/tmp/test-access.log", []byte("test log\n"), 0644)
	os.WriteFile("/tmp/test-error.log", []byte("test error\n"), 0644)

	// Run tests
	code := m.Run()

	// Cleanup: Remove test log files
	os.Remove("/tmp/test-access.log")
	os.Remove("/tmp/test-error.log")

	os.Exit(code)
}