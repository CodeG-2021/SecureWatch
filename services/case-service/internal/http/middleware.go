package http

import (
	"log/slog"
	"net/http"
	"time"
)

// Actor holds the identity injected by the API gateway via trusted headers.
type Actor struct {
	ID    string
	Email string
	Role  string
}

func actorFromRequest(r *http.Request) Actor {
	return Actor{
		ID:    r.Header.Get("X-User-ID"),
		Email: r.Header.Get("X-User-Email"),
		Role:  r.Header.Get("X-User-Role"),
	}
}

// requireAuth aborts with 401 when gateway identity headers are missing.
func requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actor := actorFromRequest(r)
		if actor.ID == "" {
			writeError(w, http.StatusUnauthorized, "missing_identity", "Identity headers are missing.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireRole returns a middleware that aborts with 403 unless the actor holds
// one of the listed roles.
func requireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			actor := actorFromRequest(r)
			if actor.ID == "" {
				writeError(w, http.StatusUnauthorized, "missing_identity", "Identity headers are missing.")
				return
			}
			if _, ok := allowed[actor.Role]; !ok {
				writeError(w, http.StatusForbidden, "insufficient_role",
					"Your role does not have permission to perform this action.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func loggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.statusCode,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}
