package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// okHandler is a trivial handler that writes 200 OK, used to verify that a
// request was allowed through the middleware.
var okHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
})

func TestMiddleware_NoTokenConfigured(t *testing.T) {
	a := NewAuthenticator("")

	handler := a.Middleware(okHandler)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
	if !contains(rec.Body.String(), "authentication is not configured") {
		t.Fatalf("expected unconfigured message, got %q", rec.Body.String())
	}
}

func TestMiddleware_MissingAuthHeader(t *testing.T) {
	a := NewAuthenticator("secret-token")

	handler := a.Middleware(okHandler)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestMiddleware_InvalidFormat(t *testing.T) {
	// "Basic" scheme must be rejected; only "Bearer" is accepted.
	a := NewAuthenticator("secret-token")

	handler := a.Middleware(okHandler)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Basic secret-token")
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestMiddleware_InvalidToken(t *testing.T) {
	a := NewAuthenticator("correct-token")

	handler := a.Middleware(okHandler)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer wrong-token")
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestMiddleware_ValidToken(t *testing.T) {
	const token = "correct-token"
	a := NewAuthenticator(token)

	handler := a.Middleware(okHandler)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestMiddleware_ErrorMessages(t *testing.T) {
	// Verify the exact lowercase error strings mandated by the API contract.
	tests := []struct {
		name          string
		header        string
		wantSubstring string
	}{
		{
			name:          "missing header",
			header:        "",
			wantSubstring: "unauthorized: missing authorization header",
		},
		{
			name:          "invalid format",
			header:        "Basic abc",
			wantSubstring: "unauthorized: invalid authorization format",
		},
		{
			name:          "invalid token",
			header:        "Bearer wrong",
			wantSubstring: "unauthorized: invalid token",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			a := NewAuthenticator("right-token")
			handler := a.Middleware(okHandler)

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			rec := httptest.NewRecorder()
			handler(rec, req)

			body := rec.Body.String()
			if !contains(body, tc.wantSubstring) {
				t.Errorf("expected body to contain %q, got %q", tc.wantSubstring, body)
			}
		})
	}
}

func TestIsEnabled(t *testing.T) {
	tests := []struct {
		name  string
		token string
		want  bool
	}{
		{name: "empty token is not a configured credential", token: "", want: false},
		{name: "non-empty token enables auth", token: "any-secret", want: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			a := NewAuthenticator(tc.token)
			if got := a.IsEnabled(); got != tc.want {
				t.Errorf("IsEnabled() = %v, want %v", got, tc.want)
			}
		})
	}
}

// contains reports whether substr is present in s.  Using a local helper keeps
// the test file free of a strings import while remaining readable.
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || indexString(s, substr) >= 0)
}

func indexString(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
