package http

import (
	"log/slog"
	"net/http"

	"github.com/codeg/securewatch/services/case-service/internal/storage"
)

func listNotificationsHandler(logger *slog.Logger, notifications *storage.NotificationRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		unreadOnly := r.URL.Query().Get("unread") == "true"
		list, err := notifications.List(r.Context(), unreadOnly)
		if err != nil {
			logger.Error("list notifications failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not fetch notifications.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"notifications": list, "total": len(list)})
	}
}

func markNotificationReadHandler(logger *slog.Logger, notifications *storage.NotificationRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			writeError(w, http.StatusBadRequest, "missing_id", "Notification ID is required.")
			return
		}
		var err error
		if id == "all" {
			err = notifications.MarkAllRead(r.Context())
		} else {
			err = notifications.MarkRead(r.Context(), id)
		}
		if err != nil {
			logger.Error("mark notification read failed", "id", id, "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Could not mark notification as read.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
