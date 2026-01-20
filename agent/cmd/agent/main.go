package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/auth"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/middleware"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/routes"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/state"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	logger.Log.Printf("Starting Traefik Log Dashboard Agent...")
	logger.Log.Printf("Access Log Path: %s", cfg.AccessPath)
	logger.Log.Printf("Error Log Path: %s", cfg.ErrorPath)
	logger.Log.Printf("System Monitoring: %v", cfg.SystemMonitoring)
	logger.Log.Printf("Port: %s", cfg.Port)

	// Initialize authentication
	authenticator := auth.NewAuthenticator(cfg.AuthToken)
	if authenticator.IsEnabled() {
		logger.Log.Printf("Authentication: Enabled")
	} else {
		logger.Log.Printf("Authentication: Disabled (no token configured)")
	}

	// Initialize state manager
	stateManager := state.NewStateManager(cfg)

	// Initialize route handler
	handler := routes.NewHandler(cfg, stateManager)

	// Create middleware chain
	chain := middleware.Chain(
		middleware.Recovery(),
		middleware.Logger(),
		middleware.CORS(middleware.DefaultCORSConfig()),
	)

	// Set up HTTP routes with middleware
	mux := http.NewServeMux()

	// Health check endpoint (no auth required)
	mux.HandleFunc("/api/logs/status", middleware.Apply(chain, handler.HandleStatus))

	// Log endpoints (with auth)
	mux.HandleFunc("/api/logs/access", middleware.Apply(chain, authenticator.Middleware(handler.HandleAccessLogs)))
	mux.HandleFunc("/api/logs/error", middleware.Apply(chain, authenticator.Middleware(handler.HandleErrorLogs)))
	mux.HandleFunc("/api/logs/get", middleware.Apply(chain, authenticator.Middleware(handler.HandleGetLog)))

	// System endpoints (with auth)
	mux.HandleFunc("/api/system/logs", middleware.Apply(chain, authenticator.Middleware(handler.HandleSystemLogs)))
	mux.HandleFunc("/api/system/resources", middleware.Apply(chain, authenticator.Middleware(handler.HandleSystemResources)))

	// Root endpoint
	mux.HandleFunc("/", middleware.Apply(chain, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"traefik-log-dashboard-agent","version":"2.0.0"}`)
	}))

	// Create HTTP server
	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	// Start server in a goroutine
	go func() {
		logger.Log.Printf("Server listening on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Log.Printf("Shutting down server...")
	if err := server.Close(); err != nil {
		logger.Log.Fatalf("Server forced to shutdown: %v", err)
	}

	logger.Log.Printf("Server exited")
}
