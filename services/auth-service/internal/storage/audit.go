package storage

import (
	"context"
	"database/sql"
)

type AuditRepository struct {
	db *sql.DB
}

func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

type AuditEntry struct {
	ActorID     string
	ActorEmail  string
	Action      string
	TargetID    string
	TargetEmail string
	OldValue    string
	NewValue    string
}

func (repo *AuditRepository) Log(ctx context.Context, entry AuditEntry) error {
	const query = `
		INSERT INTO audit_log (actor_id, actor_email, action, target_id, target_email, old_value, new_value)
		VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7)
	`
	_, err := repo.db.ExecContext(ctx, query,
		entry.ActorID,
		entry.ActorEmail,
		entry.Action,
		entry.TargetID,
		entry.TargetEmail,
		entry.OldValue,
		entry.NewValue,
	)
	return err
}
