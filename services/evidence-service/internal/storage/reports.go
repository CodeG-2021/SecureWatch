package storage

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/evidence-service/internal/domain"
)

type ReportsRepository struct {
	db *pgxpool.Pool
}

func NewReportsRepository(db *pgxpool.Pool) *ReportsRepository {
	return &ReportsRepository{db: db}
}

// Create records a newly generated report.
func (r *ReportsRepository) Create(ctx context.Context, caseID, generatedBy, storagePath string, sizeBytes int64, summary domain.ReportSummary) (domain.Report, error) {
	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		return domain.Report{}, fmt.Errorf("marshal summary: %w", err)
	}

	var rep domain.Report
	err = r.db.QueryRow(ctx, `
		INSERT INTO reports (case_id, generated_by, storage_path, file_size_bytes, summary)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, case_id, generated_by, storage_path, file_size_bytes, summary, created_at
	`, caseID, generatedBy, storagePath, sizeBytes, summaryJSON).Scan(
		&rep.ID, &rep.CaseID, &rep.GeneratedBy,
		&rep.StoragePath, &rep.FileSizeBytes, &rep.Summary, &rep.CreatedAt,
	)
	if err != nil {
		return domain.Report{}, fmt.Errorf("insert report: %w", err)
	}
	return rep, nil
}

// FindLatestByCaseID returns the most recent report for a case, or nil if none.
func (r *ReportsRepository) FindLatestByCaseID(ctx context.Context, caseID string) (*domain.Report, error) {
	var rep domain.Report
	err := r.db.QueryRow(ctx, `
		SELECT id, case_id, generated_by, storage_path, file_size_bytes, summary, created_at
		FROM reports
		WHERE case_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, caseID).Scan(
		&rep.ID, &rep.CaseID, &rep.GeneratedBy,
		&rep.StoragePath, &rep.FileSizeBytes, &rep.Summary, &rep.CreatedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("find report: %w", err)
	}
	return &rep, nil
}

// GetCaseReportData fetches all data needed to generate a report for a case.
func (r *ReportsRepository) GetCaseReportData(ctx context.Context, caseID string) (*domain.CaseReportData, error) {
	data := &domain.CaseReportData{CaseID: caseID}

	// Case info
	err := r.db.QueryRow(ctx, `
		SELECT c.title, COALESCE(c.description,''), c.priority, c.status,
		       COALESCE(u1.name,'Unknown'), COALESCE(u2.name,'Unassigned'),
		       c.risk_score, c.findings_count, c.created_at
		FROM cases c
		JOIN users u1 ON u1.id = c.created_by
		LEFT JOIN users u2 ON u2.id = c.assigned_to
		WHERE c.id = $1
	`, caseID).Scan(
		&data.CaseTitle, &data.Description, &data.Priority, &data.Status,
		&data.CreatedByName, &data.AssignedToName,
		&data.RiskScore, &data.FindingsCount, &data.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("case query: %w", err)
	}

	// Evidences
	rows, err := r.db.Query(ctx, `
		SELECT original_filename, file_type, status, size_bytes, created_at
		FROM evidences WHERE case_id = $1 ORDER BY created_at
	`, caseID)
	if err != nil {
		return nil, fmt.Errorf("evidences query: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var ev domain.EvidenceRow
		if err := rows.Scan(&ev.Filename, &ev.FileType, &ev.Status, &ev.SizeBytes, &ev.CreatedAt); err != nil {
			return nil, err
		}
		data.Evidences = append(data.Evidences, ev)
	}
	rows.Close()

	// Findings
	fRows, err := r.db.Query(ctx, `
		SELECT f.title, f.finding_type, f.severity, COALESCE(f.description,''),
		       COALESCE(e.original_filename,''), f.created_at
		FROM findings f
		LEFT JOIN evidences e ON e.id = f.evidence_id
		WHERE f.case_id = $1
		ORDER BY
		  CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
		  f.created_at
	`, caseID)
	if err != nil {
		return nil, fmt.Errorf("findings query: %w", err)
	}
	defer fRows.Close()
	for fRows.Next() {
		var f domain.FindingRow
		if err := fRows.Scan(&f.Title, &f.FindingType, &f.Severity, &f.Description, &f.Evidence, &f.CreatedAt); err != nil {
			return nil, err
		}
		data.Findings = append(data.Findings, f)
	}
	return data, fRows.Err()
}
