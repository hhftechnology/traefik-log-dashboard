package middleware

import "net/http"

// CORSConfig holds CORS configuration options
type CORSConfig struct {
	AllowOrigin  string
	AllowMethods string
	AllowHeaders string
}

// DefaultCORSConfig returns a permissive CORS configuration suitable for development
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowOrigin:  "*",
		AllowMethods: "GET, POST, OPTIONS",
		AllowHeaders: "Content-Type, Authorization",
	}
}

// CORS returns a middleware that handles CORS headers and preflight requests
func CORS(config CORSConfig) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Set CORS headers
			w.Header().Set("Access-Control-Allow-Origin", config.AllowOrigin)
			w.Header().Set("Access-Control-Allow-Methods", config.AllowMethods)
			w.Header().Set("Access-Control-Allow-Headers", config.AllowHeaders)

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
