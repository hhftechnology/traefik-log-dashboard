// Package middleware provides HTTP middleware for the Traefik Log Dashboard agent.
package middleware

import "net/http"

// Middleware is a function that wraps an http.Handler
type Middleware func(http.Handler) http.Handler

// Chain creates a new middleware chain from a list of middleware functions.
// Middleware is applied in order: first middleware in the list wraps the outermost layer.
func Chain(middlewares ...Middleware) Middleware {
	return func(next http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}

// HandlerFunc adapts an http.HandlerFunc to work with the middleware chain
func HandlerFunc(fn http.HandlerFunc) http.Handler {
	return fn
}

// Apply applies the middleware chain to an http.HandlerFunc
func Apply(chain Middleware, fn http.HandlerFunc) http.HandlerFunc {
	return chain(HandlerFunc(fn)).ServeHTTP
}
