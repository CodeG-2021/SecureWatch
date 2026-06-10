package http

import (
	"log/slog"
	"net/http"
	"time"
)

// Actor represents the authenticated user injected by the API Gateway.
type Actor struct {
	ID    string
	Email string
	Role  string
	Name  string
}

// actorFromRequest extracts the actor from X-User-* headers set by the gateway.
func actorFromRequest(r *http.Request) Actor {
	return Actor{
		ID:    r.Header.Get("X-User-Id"),
		Email: r.Header.Get("X-User-Email"),
		Role:  r.Header.Get("X-User-Role"),
		Name:  r.Header.Get("X-User-Name"),
	}
}

// requireAuth rejects requests that have no X-User-Id header (i.e. bypassed the gateway).
func requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-User-Id") == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// loggingMiddleware logs method, path, status code and duration for every request.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.status,
			"duration", time.Since(start).String(),
		)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}
