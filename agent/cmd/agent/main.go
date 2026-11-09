package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/auth"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/middleware"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/routes"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/state"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

func registerRoutes(mux *http.ServeMux, chain middleware.Middleware, handler *routes.Handler, authenticator *auth.Authenticator) {
	// Health check endpoint (no auth required)
	mux.HandleFunc("/api/logs/status", middleware.Apply(chain, handler.HandleStatus))

	// Log endpoints (with auth)
	mux.HandleFunc("/api/logs/access", middleware.Apply(chain, authenticator.Middleware(handler.HandleAccessLogs)))
	mux.HandleFunc("/api/logs/error", middleware.Apply(chain, authenticator.Middleware(handler.HandleErrorLogs)))
	mux.HandleFunc("/api/logs/get", middleware.Apply(chain, authenticator.Middleware(handler.HandleGetLog)))
	mux.HandleFunc("/api/logs/stream", middleware.Apply(chain, authenticator.Middleware(handler.HandleStreamAccessLogs)))

	// Legacy aliases kept for backwards compatibility with older clients.
	mux.HandleFunc("/stream", middleware.Apply(chain, authenticator.Middleware(handler.HandleStreamAccessLogs)))

	// System endpoints (with auth)
	mux.HandleFunc("/api/system/logs", middleware.Apply(chain, authenticator.Middleware(handler.HandleSystemLogs)))
	mux.HandleFunc("/api/system/resources", middleware.Apply(chain, authenticator.Middleware(handler.HandleSystemResources)))

	// Legacy aliases kept for backwards compatibility with older clients.
	mux.HandleFunc("/resources", middleware.Apply(chain, authenticator.Middleware(handler.HandleSystemResources)))

	// Notification proxy (with auth) — browsers can't POST to Discord/Telegram directly
	mux.HandleFunc("/api/notify", middleware.Apply(chain, authenticator.Middleware(handler.HandleNotify)))
}

func main() {
	// Load configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		logger.Log.Fatalf("Invalid configuration: %v", err)
	}

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
		logger.Log.Printf("Authentication: rejecting requests because TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN is empty")
	}

	// Initialize state manager
	stateManager := state.NewStateManager(cfg)

	// Initialize route handler
	handler := routes.NewHandler(cfg, stateManager)

	// Create middleware chain
	chain := middleware.Chain(
		middleware.Recovery(),
		middleware.SecurityHeaders(),
		middleware.RateLimit(cfg.RateLimitRPM),
		middleware.MaliciousPatternScanner(),
		middleware.Logger(),
		middleware.CORS(middleware.DefaultCORSConfig()),
	)

	// Set up HTTP routes with middleware
	mux := http.NewServeMux()

	registerRoutes(mux, chain, handler, authenticator)

	// SPA static file serving or JSON health check fallback
	distPath := filepath.Join("web", "dist")
	if info, err := os.Stat(distPath); err == nil && info.IsDir() {
		logger.Log.Printf("Serving dashboard from %s", distPath)
		fileServer := http.FileServer(http.Dir(distPath))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Let registered /api/ routes handle API requests
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}

			// Serve static assets with long-lived cache
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				fileServer.ServeHTTP(w, r)
				return
			}

			// Check if the requested file exists on disk
			filePath := filepath.Join(distPath, filepath.Clean(r.URL.Path))
			if fi, err := os.Stat(filePath); err == nil && !fi.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}

			// SPA fallback: serve index.html for all other routes
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			http.ServeFile(w, r, filepath.Join(distPath, "index.html"))
		})
	} else {
		// No dashboard build found — serve JSON health check
		mux.HandleFunc("/", middleware.Apply(chain, func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/" {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"status":"ok","service":"traefik-log-dashboard-agent","version":"2.0.0"}`)
		}))
	}

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
