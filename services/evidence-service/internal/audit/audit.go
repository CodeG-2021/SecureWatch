// Package audit provides fire-and-forget event logging to the audit_events table (HU-29).
package audit

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Event struct {
	ActorID      string
	ActorEmail   string
	Action       string
	ResourceType string
	ResourceID   string
	Metadata     map[string]any
	IPAddress    string
}

const insertSQL = `
	INSERT INTO audit_events (actor_id, actor_email, action, resource_type, resource_id, metadata, ip_address)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
`

// Write logs an audit event. Errors are only logged, never returned (non-blocking).
func Write(db *pgxpool.Pool, e Event) {
	meta, _ := json.Marshal(e.Metadata)
	if _, err := db.Exec(context.Background(), insertSQL,
		e.ActorID, e.ActorEmail, e.Action, e.ResourceType, e.ResourceID,
		string(meta), e.IPAddress,
	); err != nil {
		slog.Warn("audit write failed", "action", e.Action, "error", err)
	}
}
