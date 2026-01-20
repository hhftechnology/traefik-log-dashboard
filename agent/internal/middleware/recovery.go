package middleware

import (
	"encoding/json"
	"net/http"
	"runtime/debug"

	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

// Recovery returns a middleware that recovers from panics and returns a 500 error
func Recovery() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					logger.Log.Printf("PANIC: %v\n%s", err, debug.Stack())

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					json.NewEncoder(w).Encode(map[string]string{
						"error": "internal server error",
					})
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}
