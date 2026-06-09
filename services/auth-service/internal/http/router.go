package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/codeg/securewatch/services/auth-service/internal/config"
	"github.com/codeg/securewatch/services/auth-service/internal/domain"
	"github.com/codeg/securewatch/services/auth-service/internal/storage"
)

func NewRouter(cfg config.Config, logger *slog.Logger, users *storage.UserRepository) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", readyHandler)
	mux.HandleFunc("POST /auth/register", registerHandler(logger, users))

	return loggingMiddleware(logger, mux)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"component": "auth-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ready",
		"component": "auth-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func registerHandler(logger *slog.Logger, users *storage.UserRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input domain.RegisterUserInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
			return
		}

		input = input.Normalize()
		if err := input.Validate(); err != nil {
			writeError(w, http.StatusBadRequest, "validation_failed", err.Error())
			return
		}

		passwordHash, err := domain.HashPassword(input.Password)
		if err != nil {
			logger.Error("password hash failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not register user.")
			return
		}

		user, err := users.Create(r.Context(), input, passwordHash)
		if err != nil {
			if errors.Is(err, storage.ErrDuplicateEmail) {
				writeError(w, http.StatusConflict, "email_already_registered", "Email is already registered.")
				return
			}
			logger.Error("user registration failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not register user.")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{
			"user": user,
		})
	}
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
