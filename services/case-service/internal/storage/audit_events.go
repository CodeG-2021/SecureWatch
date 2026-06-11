package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditEvent struct {
	ID           string          `json:"id"`
	ActorID      string          `json:"actor_id"`
	ActorEmail   string          `json:"actor_email"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   *string         `json:"resource_id,omitempty"`
	Metadata     json.RawMessage `json:"metadata"`
	IPAddress    *string         `json:"ip_address,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

type AuditEventRepository struct {
	db *pgxpool.Pool
}

func NewAuditEventRepository(db *pgxpool.Pool) *AuditEventRepository {
	return &AuditEventRepository{db: db}
}

type AuditFilter struct {
	Action       string
	ResourceType string
	ActorEmail   string
	Limit        int
	Offset       int
}

func (r *AuditEventRepository) List(ctx context.Context, f AuditFilter) ([]AuditEvent, int, error) {
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 50
	}

	where := " WHERE 1=1"
	args := []any{}

	if f.Action != "" {
		args = append(args, f.Action)
		where += fmt.Sprintf(" AND action = $%d", len(args))
	}
	if f.ResourceType != "" {
		args = append(args, f.ResourceType)
		where += fmt.Sprintf(" AND resource_type = $%d", len(args))
	}
	if f.ActorEmail != "" {
		args = append(args, "%"+f.ActorEmail+"%")
		where += fmt.Sprintf(" AND actor_email ILIKE $%d", len(args))
	}

	var total int
	_ = r.db.QueryRow(ctx, "SELECT COUNT(*) FROM audit_events"+where, args...).Scan(&total)

	args = append(args, f.Limit, f.Offset)
	listQ := `SELECT id, actor_id, actor_email, action, resource_type, resource_id, metadata, ip_address, created_at
	          FROM audit_events` + where +
		fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.db.Query(ctx, listQ, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var events []AuditEvent
	for rows.Next() {
		var e AuditEvent
		if err := rows.Scan(&e.ID, &e.ActorID, &e.ActorEmail, &e.Action,
			&e.ResourceType, &e.ResourceID, &e.Metadata, &e.IPAddress, &e.CreatedAt); err != nil {
			return nil, 0, err
		}
		events = append(events, e)
	}
	if events == nil {
		events = []AuditEvent{}
	}
	return events, total, rows.Err()
}
