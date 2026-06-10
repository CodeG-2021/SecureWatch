package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const sseNotifyChannel = "securewatch_events"

// handleCaseStream opens an SSE connection and forwards PostgreSQL NOTIFY events
// filtered by caseId to the browser (HU-25).
func handleCaseStream(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool) {
	caseID := r.PathValue("caseId")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // prevent nginx buffering
	w.WriteHeader(http.StatusOK)

	fmt.Fprintf(w, ": connected to case %s\n\n", caseID)
	flusher.Flush()

	// Acquire a dedicated connection — LISTEN is per-connection state.
	conn, err := db.Acquire(r.Context())
	if err != nil {
		return
	}
	defer func() {
		// UNLISTEN before returning the connection to the pool.
		conn.Exec(context.Background(), "UNLISTEN "+sseNotifyChannel)
		conn.Release()
	}()

	if _, err := conn.Exec(r.Context(), "LISTEN "+sseNotifyChannel); err != nil {
		return
	}

	for {
		// Use a 25s timeout so we can send keepalives and detect client disconnect.
		ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
		notif, err := conn.Conn().WaitForNotification(ctx)
		cancel()

		if r.Context().Err() != nil {
			return // client disconnected
		}

		if err != nil {
			// Timeout → send keepalive comment so the connection stays alive.
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
			continue
		}

		var payload map[string]any
		if json.Unmarshal([]byte(notif.Payload), &payload) != nil {
			continue
		}
		if payload["case_id"] != caseID {
			continue
		}

		eventType, _ := payload["type"].(string)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, notif.Payload)
		flusher.Flush()
	}
}
