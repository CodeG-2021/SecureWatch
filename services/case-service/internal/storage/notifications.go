package storage

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Notification struct {
	ID        string     `json:"id"`
	CaseID    string     `json:"case_id"`
	FindingID *string    `json:"finding_id,omitempty"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	Severity  string     `json:"severity"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type NotificationRepository struct {
	db *pgxpool.Pool
}

func NewNotificationRepository(db *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) List(ctx context.Context, unreadOnly bool) ([]Notification, error) {
	query := `
		SELECT id, case_id, finding_id, title, message, severity, read_at, created_at
		FROM notifications`
	if unreadOnly {
		query += " WHERE read_at IS NULL"
	}
	query += " ORDER BY created_at DESC LIMIT 50"

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.CaseID, &n.FindingID, &n.Title, &n.Message, &n.Severity, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	if list == nil {
		list = []Notification{}
	}
	return list, rows.Err()
}

func (r *NotificationRepository) MarkRead(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		"UPDATE notifications SET read_at = NOW() WHERE id = $1 AND read_at IS NULL", id)
	return err
}

func (r *NotificationRepository) MarkAllRead(ctx context.Context) error {
	_, err := r.db.Exec(ctx, "UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL")
	return err
}
