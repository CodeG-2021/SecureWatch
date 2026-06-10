package storage

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/case-service/internal/domain"
)

// ErrCaseNotFound is returned when a case ID does not exist.
var ErrCaseNotFound = errors.New("case not found")

// CaseRepository handles all case persistence.
type CaseRepository struct {
	db *pgxpool.Pool
}

// NewCaseRepository creates a new CaseRepository.
func NewCaseRepository(db *pgxpool.Pool) *CaseRepository {
	return &CaseRepository{db: db}
}

// Create inserts a new case and returns it with creator/assignee names (HU-07).
func (r *CaseRepository) Create(ctx context.Context, input domain.CreateCaseInput, createdByID string) (domain.Case, error) {
	var caseID string

	err := r.db.QueryRow(ctx, `
		INSERT INTO cases (title, description, priority, status, created_by, assigned_to)
		VALUES ($1, $2, $3, 'open', $4, $5)
		RETURNING id
	`,
		input.Title,
		nullText(input.Description),
		input.Priority,
		createdByID,
		input.AssignedTo,
	).Scan(&caseID)

	if err != nil {
		return domain.Case{}, fmt.Errorf("insert case: %w", err)
	}

	return r.FindByID(ctx, caseID)
}

// List returns cases filtered by status, priority, and full-text search (HU-08).
func (r *CaseRepository) List(ctx context.Context, status, priority, search string) ([]domain.Case, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			c.id,
			c.title,
			COALESCE(c.description, '') AS description,
			c.priority,
			c.status,
			c.created_by,
			u1.name   AS created_by_name,
			c.assigned_to,
			u2.name   AS assigned_to_name,
			c.created_at,
			c.updated_at,
			c.closed_at
		FROM cases c
		JOIN  users u1 ON u1.id = c.created_by
		LEFT JOIN users u2 ON u2.id = c.assigned_to
		WHERE ($1 = '' OR c.status    = $1)
		  AND ($2 = '' OR c.priority  = $2)
		  AND ($3 = '' OR c.title     ILIKE '%' || $3 || '%'
		               OR c.description ILIKE '%' || $3 || '%')
		ORDER BY c.created_at DESC
	`, status, priority, search)
	if err != nil {
		return nil, fmt.Errorf("query cases: %w", err)
	}
	defer rows.Close()

	var cases []domain.Case
	for rows.Next() {
		c, err := scanCaseFull(rows)
		if err != nil {
			return nil, fmt.Errorf("scan case row: %w", err)
		}
		cases = append(cases, c)
	}
	if cases == nil {
		cases = []domain.Case{}
	}
	return cases, nil
}

// FindByID returns a single case by its UUID (HU-09).
func (r *CaseRepository) FindByID(ctx context.Context, id string) (domain.Case, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			c.id,
			c.title,
			COALESCE(c.description, '') AS description,
			c.priority,
			c.status,
			c.created_by,
			u1.name   AS created_by_name,
			c.assigned_to,
			u2.name   AS assigned_to_name,
			c.created_at,
			c.updated_at,
			c.closed_at
		FROM cases c
		JOIN  users u1 ON u1.id = c.created_by
		LEFT JOIN users u2 ON u2.id = c.assigned_to
		WHERE c.id = $1
	`, id)

	c, err := scanCaseFull(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Case{}, ErrCaseNotFound
		}
		return domain.Case{}, fmt.Errorf("find case: %w", err)
	}
	return c, nil
}

// Update applies a partial update to a case and returns the refreshed record (HU-10).
func (r *CaseRepository) Update(ctx context.Context, id string, input domain.UpdateCaseInput) (domain.Case, error) {
	existing, err := r.FindByID(ctx, id)
	if err != nil {
		return domain.Case{}, err
	}

	// Merge patch fields onto existing values
	title := existing.Title
	description := existing.Description
	priority := existing.Priority
	status := existing.Status
	assignedTo := existing.AssignedTo

	if input.Title != nil {
		title = *input.Title
	}
	if input.Description != nil {
		description = *input.Description
	}
	if input.Priority != nil {
		priority = *input.Priority
	}
	if input.Status != nil {
		status = *input.Status
	}
	if input.AssignedTo != nil {
		assignedTo = input.AssignedTo
	}

	_, err = r.db.Exec(ctx, `
		UPDATE cases
		SET title       = $1,
		    description = $2,
		    priority    = $3,
		    status      = $4,
		    assigned_to = $5,
		    updated_at  = NOW(),
		    closed_at   = CASE
		                    WHEN $4 = 'closed' AND closed_at IS NULL THEN NOW()
		                    ELSE closed_at
		                  END
		WHERE id = $6
	`, title, nullText(description), priority, status, assignedTo, id)
	if err != nil {
		return domain.Case{}, fmt.Errorf("update case: %w", err)
	}

	return r.FindByID(ctx, id)
}

// ── helpers ──────────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanCaseFull(s scanner) (domain.Case, error) {
	var c domain.Case
	err := s.Scan(
		&c.ID, &c.Title, &c.Description, &c.Priority, &c.Status,
		&c.CreatedBy, &c.CreatedByName,
		&c.AssignedTo, &c.AssignedToName,
		&c.CreatedAt, &c.UpdatedAt, &c.ClosedAt,
	)
	return c, err
}

// nullText converts an empty string to nil for nullable TEXT columns.
func nullText(s string) any {
	if s == "" {
		return nil
	}
	return s
}
