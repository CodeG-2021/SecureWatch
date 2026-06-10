package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/task-orchestrator/internal/domain"
)

// TaskRepository handles task and evidence persistence for the orchestrator.
type TaskRepository struct {
	db *pgxpool.Pool
}

// NewTaskRepository returns a new TaskRepository.
func NewTaskRepository(db *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{db: db}
}

// PendingEvidences returns evidences in 'uploaded' status that have no tasks yet.
// It joins cases to inherit the priority (HU-14).
func (r *TaskRepository) PendingEvidences(ctx context.Context) ([]domain.PendingEvidence, error) {
	const q = `
		SELECT e.id, e.case_id, e.file_type, c.priority
		FROM   evidences e
		JOIN   cases c ON c.id = e.case_id
		WHERE  e.status = 'uploaded'
		  AND  NOT EXISTS (
		         SELECT 1 FROM tasks t WHERE t.evidence_id = e.id
		       )
		ORDER BY
		  CASE c.priority
		    WHEN 'critical' THEN 1
		    WHEN 'high'     THEN 2
		    WHEN 'medium'   THEN 3
		    ELSE                 4
		  END,
		  e.created_at`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("pendingEvidences query: %w", err)
	}
	defer rows.Close()

	var out []domain.PendingEvidence
	for rows.Next() {
		var pe domain.PendingEvidence
		if err := rows.Scan(&pe.ID, &pe.CaseID, &pe.FileType, &pe.Priority); err != nil {
			return nil, fmt.Errorf("pendingEvidences scan: %w", err)
		}
		out = append(out, pe)
	}
	return out, rows.Err()
}

// CreateTask inserts a new task record and returns it (HU-14).
func (r *TaskRepository) CreateTask(ctx context.Context, pe domain.PendingEvidence, taskType, queueName string) (*domain.Task, error) {
	const q = `
		INSERT INTO tasks (case_id, evidence_id, task_type, queue_name, priority, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')
		RETURNING id, case_id, evidence_id, task_type, queue_name, priority, status,
		          retry_count, max_retries, created_at, updated_at`

	var t domain.Task
	err := r.db.QueryRow(ctx, q,
		pe.CaseID, pe.ID, taskType, queueName, pe.Priority,
	).Scan(
		&t.ID, &t.CaseID, &t.EvidenceID, &t.TaskType, &t.QueueName,
		&t.Priority, &t.Status, &t.RetryCount, &t.MaxRetries,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("createTask: %w", err)
	}
	return &t, nil
}

// MarkEvidenceClassified updates evidence status to 'classified' (HU-14).
func (r *TaskRepository) MarkEvidenceClassified(ctx context.Context, evidenceID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE evidences SET status='classified', updated_at=NOW() WHERE id=$1`,
		evidenceID,
	)
	return err
}

// MarkTaskQueued updates task status to 'queued' after successful RabbitMQ publish (HU-15).
func (r *TaskRepository) MarkTaskQueued(ctx context.Context, taskID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE tasks SET status='queued', updated_at=NOW() WHERE id=$1`,
		taskID,
	)
	return err
}

// MarkEvidenceQueued updates evidence status to 'queued' (HU-15).
func (r *TaskRepository) MarkEvidenceQueued(ctx context.Context, evidenceID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE evidences SET status='queued', updated_at=NOW() WHERE id=$1`,
		evidenceID,
	)
	return err
}

// MarkTaskFailed marks a task as failed with an error message.
func (r *TaskRepository) MarkTaskFailed(ctx context.Context, taskID, errMsg string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE tasks SET status='failed', error_message=$2, failed_at=NOW(), updated_at=NOW() WHERE id=$1`,
		taskID, errMsg,
	)
	return err
}
