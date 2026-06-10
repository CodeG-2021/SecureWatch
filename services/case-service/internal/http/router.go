package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/case-service/internal/config"
	"github.com/codeg/securewatch/services/case-service/internal/domain"
	"github.com/codeg/securewatch/services/case-service/internal/storage"
)

// NewRouter wires all case-service routes and middleware.
func NewRouter(cfg config.Config, logger *slog.Logger, cases *storage.CaseRepository, notifications *storage.NotificationRepository, db *pgxpool.Pool) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", readyHandler)
	mux.HandleFunc("GET /dashboard/metrics", requireAuth(dashboardMetricsHandler(db)).ServeHTTP)

	// All case routes require a valid actor identity injected by the gateway.
	auth := requireAuth

	mux.Handle("POST /cases",         auth(createCaseHandler(logger, cases)))
	mux.Handle("GET /cases",          auth(listCasesHandler(logger, cases)))
	mux.Handle("GET /cases/{id}",     auth(getCaseHandler(logger, cases)))
	mux.Handle("PATCH /cases/{id}",   auth(updateCaseHandler(logger, cases)))

	mux.Handle("GET /notifications",             auth(listNotificationsHandler(logger, notifications)))
	mux.Handle("PATCH /notifications/{id}/read", auth(markNotificationReadHandler(logger, notifications)))

	return loggingMiddleware(logger, mux)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"component": "case-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func readyHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ready",
		"component": "case-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// createCaseHandler creates a new case (HU-07).
func createCaseHandler(logger *slog.Logger, cases *storage.CaseRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input domain.CreateCaseInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
			return
		}
		input = input.Normalize()
		if err := input.Validate(); err != nil {
			writeError(w, http.StatusBadRequest, "validation_failed", err.Error())
			return
		}

		actor := actorFromRequest(r)
		c, err := cases.Create(r.Context(), input, actor.ID)
		if err != nil {
			logger.Error("create case failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not create case.")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"case": c})
	}
}

// listCasesHandler returns filtered cases (HU-08).
func listCasesHandler(logger *slog.Logger, cases *storage.CaseRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		status := q.Get("status")
		priority := q.Get("priority")
		search := q.Get("search")

		list, err := cases.List(r.Context(), status, priority, search)
		if err != nil {
			logger.Error("list cases failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not fetch cases.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"cases": list, "total": len(list)})
	}
}

// getCaseHandler returns a single case detail (HU-09).
func getCaseHandler(logger *slog.Logger, cases *storage.CaseRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			writeError(w, http.StatusBadRequest, "missing_id", "Case ID is required.")
			return
		}
		c, err := cases.FindByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, storage.ErrCaseNotFound) {
				writeError(w, http.StatusNotFound, "case_not_found", "Case not found.")
				return
			}
			logger.Error("get case failed", "id", id, "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not fetch case.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"case": c})
	}
}

// updateCaseHandler patches a case (HU-10).
// Admins and supervisors may update any case; analysts may only update their own.
func updateCaseHandler(logger *slog.Logger, cases *storage.CaseRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			writeError(w, http.StatusBadRequest, "missing_id", "Case ID is required.")
			return
		}

		// Fetch current record first (authorisation check below)
		existing, err := cases.FindByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, storage.ErrCaseNotFound) {
				writeError(w, http.StatusNotFound, "case_not_found", "Case not found.")
				return
			}
			logger.Error("fetch case for update failed", "id", id, "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not fetch case.")
			return
		}

		// Permission: admin/supervisor can edit anything; analyst only their own cases
		actor := actorFromRequest(r)
		if actor.Role != "admin" && actor.Role != "supervisor" && existing.CreatedBy != actor.ID {
			writeError(w, http.StatusForbidden, "insufficient_permission",
				"You can only update cases you created.")
			return
		}

		var input domain.UpdateCaseInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
			return
		}
		if err := input.Validate(); err != nil {
			writeError(w, http.StatusBadRequest, "validation_failed", err.Error())
			return
		}

		updated, err := cases.Update(r.Context(), id, input)
		if err != nil {
			logger.Error("update case failed", "id", id, "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not update case.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"case": updated})
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
