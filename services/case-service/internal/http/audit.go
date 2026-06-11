package http

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/codeg/securewatch/services/case-service/internal/storage"
)

func listAuditEventsHandler(logger *slog.Logger, auditRepo *storage.AuditEventRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))

		filter := storage.AuditFilter{
			Action:       q.Get("action"),
			ResourceType: q.Get("resource_type"),
			ActorEmail:   q.Get("actor_email"),
			Limit:        limit,
			Offset:       offset,
		}

		events, total, err := auditRepo.List(r.Context(), filter)
		if err != nil {
			logger.Error("list audit events failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not fetch audit events.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"events": events, "total": total})
	}
}
