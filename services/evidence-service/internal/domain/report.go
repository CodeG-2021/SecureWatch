package domain

import (
	"encoding/json"
	"time"
)

// Report holds metadata for a generated case report (HU-22).
type Report struct {
	ID            string          `json:"id"`
	CaseID        string          `json:"case_id"`
	GeneratedBy   string          `json:"generated_by"`
	StoragePath   string          `json:"storage_path"`
	FileSizeBytes int64           `json:"file_size_bytes"`
	Summary       json.RawMessage `json:"summary"`
	CreatedAt     time.Time       `json:"created_at"`
	DownloadURL   string          `json:"download_url,omitempty"`
}

// ReportSummary is stored as JSONB and exposed in the report metadata.
type ReportSummary struct {
	CaseTitle      string `json:"case_title"`
	Priority       string `json:"priority"`
	Status         string `json:"status"`
	RiskScore      float64 `json:"risk_score"`
	EvidencesCount int    `json:"evidences_count"`
	FindingsCount  int    `json:"findings_count"`
	Critical       int    `json:"critical"`
	High           int    `json:"high"`
	Medium         int    `json:"medium"`
	Low            int    `json:"low"`
}

// CaseReportData aggregates all data needed to generate the report.
type CaseReportData struct {
	CaseID         string
	CaseTitle      string
	Description    string
	Priority       string
	Status         string
	CreatedByName  string
	AssignedToName string
	RiskScore      float64
	FindingsCount  int
	CreatedAt      time.Time
	Evidences      []EvidenceRow
	Findings       []FindingRow
}

type EvidenceRow struct {
	Filename  string
	FileType  string
	Status    string
	SizeBytes int64
	CreatedAt time.Time
}

type FindingRow struct {
	Title       string
	FindingType string
	Severity    string
	Description string
	Evidence    string
	CreatedAt   time.Time
}
