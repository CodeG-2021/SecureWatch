package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/evidence-service/internal/domain"
)

// EvidenceRepository handles all evidence persistence operations.
type EvidenceRepository struct {
	db *pgxpool.Pool
}

// NewEvidenceRepository returns a new EvidenceRepository backed by the given pool.
func NewEvidenceRepository(db *pgxpool.Pool) *EvidenceRepository {
	return &EvidenceRepository{db: db}
}

// Create inserts a new evidence record and returns the full record with joined fields.
func (r *EvidenceRepository) Create(ctx context.Context, in domain.CreateEvidenceInput) (*domain.Evidence, error) {
	const q = `
		INSERT INTO evidences
			(case_id, original_filename, file_type, mime_type, storage_path,
			 size_bytes, hash_sha256, status, uploaded_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'uploaded',$8)
		RETURNING id`

	var id string
	err := r.db.QueryRow(ctx, q,
		in.CaseID, in.OriginalFilename, in.FileType, in.MIMEType,
		in.StoragePath, in.SizeBytes, in.HashSHA256, in.UploadedBy,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("evidence insert: %w", err)
	}
	return r.FindByID(ctx, id)
}

// List returns all evidence records for a given case, ordered by creation date descending.
func (r *EvidenceRepository) List(ctx context.Context, caseID string) ([]domain.Evidence, error) {
	const q = `
		SELECT
			e.id, e.case_id, e.original_filename, e.file_type, e.mime_type,
			e.storage_path, e.size_bytes, e.hash_sha256, e.status,
			e.uploaded_by, COALESCE(u.name,'') AS uploaded_by_name,
			e.created_at, e.updated_at
		FROM evidences e
		LEFT JOIN users u ON u.id = e.uploaded_by
		WHERE e.case_id = $1
		ORDER BY e.created_at DESC`

	rows, err := r.db.Query(ctx, q, caseID)
	if err != nil {
		return nil, fmt.Errorf("evidence list query: %w", err)
	}
	defer rows.Close()

	var out []domain.Evidence
	for rows.Next() {
		var ev domain.Evidence
		if err := rows.Scan(
			&ev.ID, &ev.CaseID, &ev.OriginalFilename, &ev.FileType, &ev.MIMEType,
			&ev.StoragePath, &ev.SizeBytes, &ev.HashSHA256, &ev.Status,
			&ev.UploadedBy, &ev.UploadedByName,
			&ev.CreatedAt, &ev.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("evidence list scan: %w", err)
		}
		out = append(out, ev)
	}
	return out, rows.Err()
}

// FindByID retrieves a single evidence record by its ID.
func (r *EvidenceRepository) FindByID(ctx context.Context, id string) (*domain.Evidence, error) {
	const q = `
		SELECT
			e.id, e.case_id, e.original_filename, e.file_type, e.mime_type,
			e.storage_path, e.size_bytes, e.hash_sha256, e.status,
			e.uploaded_by, COALESCE(u.name,'') AS uploaded_by_name,
			e.created_at, e.updated_at
		FROM evidences e
		LEFT JOIN users u ON u.id = e.uploaded_by
		WHERE e.id = $1`

	var ev domain.Evidence
	err := r.db.QueryRow(ctx, q, id).Scan(
		&ev.ID, &ev.CaseID, &ev.OriginalFilename, &ev.FileType, &ev.MIMEType,
		&ev.StoragePath, &ev.SizeBytes, &ev.HashSHA256, &ev.Status,
		&ev.UploadedBy, &ev.UploadedByName,
		&ev.CreatedAt, &ev.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("evidence findByID: %w", err)
	}
	return &ev, nil
}

// ExistsByHash returns true if an evidence with the given hash already exists in the case.
func (r *EvidenceRepository) ExistsByHash(ctx context.Context, caseID, hash string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM evidences WHERE case_id=$1 AND hash_sha256=$2)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, caseID, hash).Scan(&exists); err != nil {
		return false, fmt.Errorf("evidence existsByHash: %w", err)
	}
	return exists, nil
}
