package domain

import (
	"strings"
	"time"
)

// MaxFileSize is the maximum accepted upload size (100 MB).
const MaxFileSize = 100 * 1024 * 1024

// Evidence is a piece of digital evidence attached to a case.
type Evidence struct {
	ID               string    `json:"id"`
	CaseID           string    `json:"case_id"`
	OriginalFilename string    `json:"original_filename"`
	FileType         string    `json:"file_type"`
	MIMEType         string    `json:"mime_type"`
	StoragePath      string    `json:"storage_path"`
	SizeBytes        int64     `json:"size_bytes"`
	HashSHA256       string    `json:"hash_sha256"`
	Status           string    `json:"status"`
	UploadedBy       string    `json:"uploaded_by"`
	UploadedByName   string    `json:"uploaded_by_name,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// CreateEvidenceInput holds the validated data needed to persist a new evidence record.
type CreateEvidenceInput struct {
	CaseID           string
	OriginalFilename string
	FileType         string
	MIMEType         string
	StoragePath      string
	SizeBytes        int64
	HashSHA256       string
	UploadedBy       string
}

// ─── MIME validation (HU-12) ─────────────────────────────────────────────────

// allowedMIMETypes is the set of MIME types accepted by the platform.
var allowedMIMETypes = map[string]bool{
	// Text
	"text/plain":       true,
	"text/csv":         true,
	"text/xml":         true,
	"application/json": true,
	// Images
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
	"image/bmp":  true,
	"image/tiff": true,
	// Audio
	"audio/mpeg":  true, // mp3
	"audio/wav":   true,
	"audio/ogg":   true,
	"audio/flac":  true,
	"audio/mp4":   true,
	"audio/x-m4a": true,
	"audio/webm":  true,
	// Documents
	"application/pdf":  true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel":                                                 true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":        true,
	"application/vnd.ms-powerpoint":                                             true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
	// Archives
	"application/zip":             true,
	"application/x-tar":           true,
	"application/gzip":            true,
	"application/x-7z-compressed": true,
	"application/x-rar-compressed": true,
	"application/x-bzip2":          true,
}

// IsAllowedMIME returns true when the MIME type is supported.
func IsAllowedMIME(mimeType string) bool {
	// Strip parameters (e.g. "text/plain; charset=utf-8" → "text/plain")
	base := strings.SplitN(mimeType, ";", 2)[0]
	base = strings.TrimSpace(strings.ToLower(base))
	return allowedMIMETypes[base]
}

// ─── Classification (HU-13) ───────────────────────────────────────────────────

// ClassifyMIME maps a MIME type to one of the platform's evidence categories.
func ClassifyMIME(mimeType string) string {
	base := strings.SplitN(mimeType, ";", 2)[0]
	base = strings.TrimSpace(strings.ToLower(base))

	switch {
	case strings.HasPrefix(base, "text/"),
		base == "application/json":
		return "text"
	case strings.HasPrefix(base, "image/"):
		return "image"
	case strings.HasPrefix(base, "audio/"),
		base == "audio/x-m4a":
		return "audio"
	case base == "application/pdf",
		base == "application/msword",
		strings.Contains(base, "wordprocessingml"),
		strings.Contains(base, "spreadsheetml"),
		strings.Contains(base, "presentationml"),
		strings.Contains(base, "ms-excel"),
		strings.Contains(base, "ms-powerpoint"):
		return "document"
	case strings.Contains(base, "zip"),
		strings.Contains(base, "tar"),
		strings.Contains(base, "gzip"),
		strings.Contains(base, "7z"),
		strings.Contains(base, "rar"),
		strings.Contains(base, "bzip"):
		return "archive"
	default:
		return "unknown"
	}
}
