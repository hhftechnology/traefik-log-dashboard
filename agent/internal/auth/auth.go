package auth

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

// Authenticator handles authentication for the agent
type Authenticator struct {
	token string
}

// NewAuthenticator creates a new authenticator with the given token
func NewAuthenticator(token string) *Authenticator {
	return &Authenticator{
		token: token,
	}
}

// Middleware returns an HTTP middleware that validates Bearer tokens
func (a *Authenticator) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Fail closed: an empty token must not leave the API open.
		if a.token == "" {
			http.Error(w, "unauthorized: authentication is not configured", http.StatusUnauthorized)
			return
		}

		// Get Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "unauthorized: missing authorization header", http.StatusUnauthorized)
			return
		}

		// Check for Bearer token format
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "unauthorized: invalid authorization format", http.StatusUnauthorized)
			return
		}

		// Validate token using constant-time comparison to prevent timing attacks
		token := parts[1]
		if subtle.ConstantTimeCompare([]byte(token), []byte(a.token)) != 1 {
			http.Error(w, "unauthorized: invalid token", http.StatusUnauthorized)
			return
		}

		// Token is valid, proceed to next handler
		next(w, r)
	}
}

// IsEnabled returns true if authentication is enabled
func (a *Authenticator) IsEnabled() bool {
	return a.token != ""
}