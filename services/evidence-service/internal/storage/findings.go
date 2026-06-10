package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/evidence-service/internal/domain"
)

type FindingsRepository struct {
	db *pgxpool.Pool
}

func NewFindingsRepository(db *pgxpool.Pool) *FindingsRepository {
	return &FindingsRepository{db: db}
}

func (r *FindingsRepository) ListByCaseID(ctx context.Context, caseID, evidenceID string) ([]domain.Finding, error) {
	q := `
		SELECT
			f.id, f.case_id, f.evidence_id, f.task_id,
			f.finding_type, f.title, COALESCE(f.description, ''),
			f.severity, f.data, f.created_at,
			COALESCE(e.original_filename, '') AS evidence_filename
		FROM findings f
		LEFT JOIN evidences e ON e.id = f.evidence_id
		WHERE f.case_id = $1`

	args := []any{caseID}
	if evidenceID != "" {
		q += ` AND f.evidence_id = $2`
		args = append(args, evidenceID)
	}
	q += ` ORDER BY f.created_at DESC`

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("findings list: %w", err)
	}
	defer rows.Close()

	var out []domain.Finding
	for rows.Next() {
		var f domain.Finding
		if err := rows.Scan(
			&f.ID, &f.CaseID, &f.EvidenceID, &f.TaskID,
			&f.FindingType, &f.Title, &f.Description,
			&f.Severity, &f.Data, &f.CreatedAt,
			&f.EvidenceFilename,
		); err != nil {
			return nil, fmt.Errorf("findings scan: %w", err)
		}
		out = append(out, f)
	}
	return out, rows.Err()
}
