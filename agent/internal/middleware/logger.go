package middleware

import (
	"net/http"
	"time"

	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

// responseWriter wraps http.ResponseWriter to capture the status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Logger returns a middleware that logs HTTP requests
func Logger() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap the response writer to capture status code
			wrapped := &responseWriter{
				ResponseWriter: w,
				status:         http.StatusOK,
			}

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start)
			logger.Log.Printf("%s %s %d %v",
				r.Method,
				r.URL.Path,
				wrapped.status,
				duration,
			)
		})
	}
}
