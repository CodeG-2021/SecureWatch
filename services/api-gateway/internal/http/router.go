package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/codeg/securewatch/services/api-gateway/internal/config"
)

func NewRouter(cfg config.Config, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", readyHandler)
	mux.HandleFunc("GET /metrics", metricsHandler)
	mux.HandleFunc("GET /api/v1", apiIndexHandler)
	mux.HandleFunc("GET /api/v1/me", meHandler)
	mux.Handle("POST /api/v1/auth/register", authServiceProxy(cfg, logger, "/auth/register"))
	mux.Handle("POST /api/v1/auth/login", authServiceProxy(cfg, logger, "/auth/login"))

	handler := recoverMiddleware(logger, mux)
	handler = authMiddleware(cfg, logger, handler)
	handler = loggingMiddleware(logger, handler)
	handler = requestIDMiddleware(handler)
	handler = corsMiddleware(cfg, handler)

	return handler
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"component": "api-gateway",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ready",
		"component": "api-gateway",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = w.Write([]byte("# HELP securewatch_api_gateway_up API Gateway process health.\n"))
	_, _ = w.Write([]byte("# TYPE securewatch_api_gateway_up gauge\n"))
	_, _ = w.Write([]byte("securewatch_api_gateway_up 1\n"))
}

func apiIndexHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"name":    "SecureWatch API Gateway",
		"version": "v1",
		"routes": []string{
			"GET /healthz",
			"GET /readyz",
			"GET /metrics",
			"GET /api/v1",
			"GET /api/v1/me",
			"POST /api/v1/auth/register",
			"POST /api/v1/auth/login",
		},
	})
}

func authServiceProxy(cfg config.Config, logger *slog.Logger, targetPath string) http.Handler {
	target, err := url.Parse(cfg.AuthServiceURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger.Error("invalid auth service url", "url", cfg.AuthServiceURL, "error", err)
			writeError(w, http.StatusInternalServerError, "invalid_upstream", "Auth service is not configured.")
		})
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		originalDirector(r)
		r.URL.Path = targetPath
		r.Host = target.Host
		r.Header.Set("X-Forwarded-Host", r.Host)
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("auth service proxy failed", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", "Auth service is unavailable.")
	}

	return proxy
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"claims":        claims,
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
