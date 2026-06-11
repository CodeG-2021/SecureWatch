package domain

import (
	"encoding/json"
	"time"
)

type Finding struct {
	ID               string          `json:"id"`
	CaseID           string          `json:"case_id"`
	EvidenceID       string          `json:"evidence_id"`
	TaskID           *string         `json:"task_id,omitempty"`
	FindingType      string          `json:"finding_type"`
	Title            string          `json:"title"`
	Description      string          `json:"description,omitempty"`
	Severity         string          `json:"severity"`
	Data             json.RawMessage `json:"data"`
	CreatedAt        time.Time       `json:"created_at"`
	EvidenceFilename string          `json:"evidence_filename,omitempty"`
}
