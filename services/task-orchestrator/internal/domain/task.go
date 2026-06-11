package domain

import "time"

// Task represents a unit of analysis work derived from an evidence file.
type Task struct {
	ID           string     `json:"id"`
	CaseID       string     `json:"case_id"`
	EvidenceID   string     `json:"evidence_id"`
	TaskType     string     `json:"task_type"`
	QueueName    string     `json:"queue_name"`
	Priority     string     `json:"priority"`
	Status       string     `json:"status"`
	RetryCount   int        `json:"retry_count"`
	MaxRetries   int        `json:"max_retries"`
	WorkerID     *string    `json:"worker_id,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	FailedAt     *time.Time `json:"failed_at,omitempty"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// PendingEvidence is returned by the DB query that finds evidences needing tasks.
type PendingEvidence struct {
	ID       string
	CaseID   string
	FileType string
	Priority string // inherited from the parent case
}

// ─── Routing rules (HU-14 + HU-15) ───────────────────────────────────────────

// TaskTypeForFileType maps an evidence file_type → task_type.
func TaskTypeForFileType(fileType string) string {
	switch fileType {
	case "text":     return "text_analysis"
	case "image":    return "image_analysis"
	case "audio":    return "audio_analysis"
	case "document": return "document_analysis"
	case "archive":  return "archive_analysis"
	default:         return "document_analysis"
	}
}

// QueueForTaskType maps task_type → RabbitMQ queue name.
func QueueForTaskType(taskType string) string {
	return "tasks." + taskType
}

// TaskMessage is the payload published to RabbitMQ (HU-15).
type TaskMessage struct {
	TaskID     string `json:"task_id"`
	CaseID     string `json:"case_id"`
	EvidenceID string `json:"evidence_id"`
	TaskType   string `json:"task_type"`
	Priority   string `json:"priority"`
}
