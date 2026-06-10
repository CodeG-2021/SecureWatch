package http

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/codeg/securewatch/services/api-gateway/internal/config"
)

type contextKey string

const (
	requestIDKey contextKey = "request_id"
	claimsKey    contextKey = "claims"
)

type JWTClaims map[string]any

func ClaimsFromContext(ctx context.Context) (JWTClaims, bool) {
	claims, ok := ctx.Value(claimsKey).(JWTClaims)
	return claims, ok
}

func corsMiddleware(cfg config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && isAllowedOrigin(origin, cfg.CORSAllowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", strings.Join(cfg.CORSAllowedMethods, ", "))
			w.Header().Set("Access-Control-Allow-Headers", strings.Join(cfg.CORSAllowedHeaders, ", "))
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = newRequestID()
		}

		w.Header().Set("X-Request-ID", requestID)
		ctx := context.WithValue(r.Context(), requestIDKey, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func loggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(recorder, r)

		logger.Info(
			"http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.statusCode,
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", r.Context().Value(requestIDKey),
			"remote_addr", r.RemoteAddr,
		)
	})
}

func authMiddleware(cfg config.Config, logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !cfg.RequireAuth || isPublicRoute(r.URL.Path) || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" || token == r.Header.Get("Authorization") {
			writeError(w, http.StatusUnauthorized, "missing_token", "Bearer token is required.")
			return
		}

		claims, err := validateHS256JWT(token, cfg.JWTSecret)
		if err != nil {
			logger.Warn("jwt validation failed", "error", err, "request_id", r.Context().Value(requestIDKey))
			writeError(w, http.StatusUnauthorized, "invalid_token", "Bearer token is invalid.")
			return
		}

		// Forward identity to upstream services via trusted headers
		r = r.Clone(r.Context())
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-ID", sub)
		}
		if email, ok := claims["email"].(string); ok {
			r.Header.Set("X-User-Email", email)
		}
		if role, ok := claims["role"].(string); ok {
			r.Header.Set("X-User-Role", role)
		}

		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func recoverMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("request panic", "panic", recovered, "request_id", r.Context().Value(requestIDKey))
				writeError(w, http.StatusInternalServerError, "internal_error", "Unexpected server error.")
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func isAllowedOrigin(origin string, allowed []string) bool {
	return slices.Contains(allowed, "*") || slices.Contains(allowed, origin)
}

func isPublicRoute(path string) bool {
	return path == "/healthz" ||
		path == "/readyz" ||
		path == "/metrics" ||
		path == "/api/v1/auth/register" ||
		path == "/api/v1/auth/login"
}

func validateHS256JWT(token string, secret string) (JWTClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errInvalidToken
	}

	signingInput := parts[0] + "." + parts[1]
	expectedMAC := hmac.New(sha256.New, []byte(secret))
	_, _ = expectedMAC.Write([]byte(signingInput))
	expectedSignature := expectedMAC.Sum(nil)

	actualSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errInvalidToken
	}

	if !hmac.Equal(actualSignature, expectedSignature) {
		return nil, errInvalidToken
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errInvalidToken
	}

	claims := JWTClaims{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, errInvalidToken
	}

	if exp, ok := claims["exp"].(float64); ok && int64(exp) < time.Now().Unix() {
		return nil, errExpiredToken
	}

	return claims, nil
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func newRequestID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(bytes[:])
}

var (
	errInvalidToken = &tokenError{message: "invalid token"}
	errExpiredToken = &tokenError{message: "expired token"}
)

type tokenError struct {
	message string
}

func (e *tokenError) Error() string {
	return e.message
}
