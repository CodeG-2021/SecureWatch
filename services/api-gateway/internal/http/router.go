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

	// ── auth-service ─────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/auth/register", authServiceProxy(cfg, logger, "/auth/register"))
	mux.Handle("POST /api/v1/auth/login",    authServiceProxy(cfg, logger, "/auth/login"))
	mux.Handle("GET /api/v1/users",                  authServiceProxyPath(cfg, logger, "/auth/users"))
	mux.Handle("PATCH /api/v1/users/{id}/role",      authServiceProxyDynamic(cfg, logger, "/auth/users", "role"))

	// ── case-service ─────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/cases",          caseServiceProxy(cfg, logger, "/cases"))
	mux.Handle("GET /api/v1/cases",           caseServiceProxy(cfg, logger, "/cases"))
	mux.Handle("GET /api/v1/cases/{id}",      caseServiceProxyDynamic(cfg, logger))
	mux.Handle("PATCH /api/v1/cases/{id}",    caseServiceProxyDynamic(cfg, logger))

	// ── evidence-service ──────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/cases/{caseId}/evidences", evidenceServiceProxyDynamic(cfg, logger))
	mux.Handle("GET /api/v1/cases/{caseId}/evidences",  evidenceServiceProxyDynamic(cfg, logger))
	mux.Handle("GET /api/v1/cases/{caseId}/findings",   evidenceServiceCaseProxy(cfg, logger, "findings"))
	mux.Handle("POST /api/v1/cases/{caseId}/report",    evidenceServiceCaseProxy(cfg, logger, "report"))
	mux.Handle("GET /api/v1/cases/{caseId}/report",     evidenceServiceCaseProxy(cfg, logger, "report"))

	// HU-25: real-time SSE stream — flush immediately so events reach the browser
	mux.Handle("GET /api/v1/cases/{caseId}/stream",     evidenceServiceStreamProxy(cfg, logger))

	// ── notifications (HU-26) ────────────────────────────────────────────────
	mux.Handle("GET /api/v1/notifications",              caseServiceProxy(cfg, logger, "/notifications"))
	mux.Handle("PATCH /api/v1/notifications/{id}/read",  caseServiceNotificationReadProxy(cfg, logger))

	// ── dashboard metrics (HU-24) ─────────────────────────────────────────────
	mux.Handle("GET /api/v1/dashboard/metrics", caseServiceProxy(cfg, logger, "/dashboard/metrics"))

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
			"GET /api/v1/users",
			"PATCH /api/v1/users/{id}/role",
			"POST /api/v1/cases",
			"GET /api/v1/cases",
			"GET /api/v1/cases/{id}",
			"PATCH /api/v1/cases/{id}",
			"POST /api/v1/cases/{caseId}/evidences",
			"GET /api/v1/cases/{caseId}/evidences",
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

// authServiceProxyPath proxies to a fixed upstream path (no rewrite needed).
func authServiceProxyPath(cfg config.Config, logger *slog.Logger, targetPath string) http.Handler {
	return authServiceProxy(cfg, logger, targetPath)
}

// authServiceProxyDynamic proxies dynamic path segments, e.g. /api/v1/users/{id}/role
// → /auth/users/{id}/role, preserving the path variable.
func authServiceProxyDynamic(cfg config.Config, logger *slog.Logger, prefix string, suffix string) http.Handler {
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
		id := r.PathValue("id")
		r.URL.Path = prefix + "/" + id + "/" + suffix
		r.Host = target.Host
		r.Header.Set("X-Forwarded-Host", r.Host)
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("auth service proxy failed", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", "Auth service is unavailable.")
	}

	return proxy
}

// caseServiceProxy forwards a request to a fixed path on the case-service.
func caseServiceProxy(cfg config.Config, logger *slog.Logger, targetPath string) http.Handler {
	target, err := url.Parse(cfg.CaseServiceURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger.Error("invalid case service url", "url", cfg.CaseServiceURL, "error", err)
			writeError(w, http.StatusInternalServerError, "invalid_upstream", "Case service is not configured.")
		})
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	orig := proxy.Director
	proxy.Director = func(r *http.Request) {
		orig(r)
		r.URL.Path = targetPath
		r.URL.RawQuery = r.URL.RawQuery // preserve query params for GET /cases?status=...
		r.Host = target.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("case service proxy failed", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", "Case service is unavailable.")
	}
	return proxy
}

// caseServiceProxyDynamic preserves the {id} path variable when proxying to case-service.
func caseServiceProxyDynamic(cfg config.Config, logger *slog.Logger) http.Handler {
	target, err := url.Parse(cfg.CaseServiceURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger.Error("invalid case service url", "url", cfg.CaseServiceURL, "error", err)
			writeError(w, http.StatusInternalServerError, "invalid_upstream", "Case service is not configured.")
		})
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	orig := proxy.Director
	proxy.Director = func(r *http.Request) {
		orig(r)
		id := r.PathValue("id")
		r.URL.Path = "/cases/" + id
		r.Host = target.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("case service proxy failed", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", "Case service is unavailable.")
	}
	return proxy
}

// evidenceServiceProxyDynamic forwards /api/v1/cases/{caseId}/evidences → evidence-service.
func evidenceServiceProxyDynamic(cfg config.Config, logger *slog.Logger) http.Handler {
	return evidenceServiceCaseProxy(cfg, logger, "evidences")
}

// evidenceServiceStreamProxy proxies the SSE stream endpoint with immediate flushing.
func evidenceServiceStreamProxy(cfg config.Config, logger *slog.Logger) http.Handler {
	target, err := url.Parse(cfg.EvidenceServiceURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, http.StatusInternalServerError, "invalid_upstream", "Evidence service is not configured.")
		})
	}
	proxy := &httputil.ReverseProxy{
		FlushInterval: -1, // flush every write immediately (required for SSE)
		Director: func(r *http.Request) {
			r.URL.Scheme = target.Scheme
			r.URL.Host = target.Host
			r.Host = target.Host
			caseID := r.PathValue("caseId")
			r.URL.Path = "/cases/" + caseID + "/stream"
			// Remove token query param before forwarding (auth already validated)
			q := r.URL.Query()
			q.Del("token")
			r.URL.RawQuery = q.Encode()
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.Error("stream proxy failed", "error", err)
			writeError(w, http.StatusBadGateway, "upstream_unavailable", "Evidence service is unavailable.")
		},
	}
	return proxy
}

// evidenceServiceCaseProxy proxies /api/v1/cases/{caseId}/<resource> → evidence-service.
func evidenceServiceCaseProxy(cfg config.Config, logger *slog.Logger, resource string) http.Handler {
	target, err := url.Parse(cfg.EvidenceServiceURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger.Error("invalid evidence service url", "url", cfg.EvidenceServiceURL, "error", err)
			writeError(w, http.StatusInternalServerError, "invalid_upstream", "Evidence service is not configured.")
		})
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	orig := proxy.Director
	proxy.Director = func(r *http.Request) {
		orig(r)
		caseID := r.PathValue("caseId")
		r.URL.Path = "/cases/" + caseID + "/" + resource
		r.URL.RawQuery = r.URL.RawQuery
		r.Host = target.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("evidence service proxy failed", "resource", resource, "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", "Evidence service is unavailable.")
	}
	return proxy
}

// caseServiceNotificationReadProxy proxies PATCH /api/v1/notifications/{id}/read → case-service.
func caseServiceNotificationReadProxy(cfg config.Config, logger *slog.Logger) http.Handler {
	target, err := url.Parse(cfg.CaseServiceURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger.Error("invalid case service url", "url", cfg.CaseServiceURL, "error", err)
			writeError(w, http.StatusInternalServerError, "invalid_upstream", "Case service is not configured.")
		})
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	orig := proxy.Director
	proxy.Director = func(r *http.Request) {
		orig(r)
		id := r.PathValue("id")
		r.URL.Path = "/notifications/" + id + "/read"
		r.Host = target.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("case service proxy failed", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", "Case service is unavailable.")
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
