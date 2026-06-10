package http

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/evidence-service/internal/domain"
	"github.com/codeg/securewatch/services/evidence-service/internal/storage"
)

// NewRouter builds and returns the HTTP mux for the evidence service.
func NewRouter(
	evidences *storage.EvidenceRepository,
	findings *storage.FindingsRepository,
	reports *storage.ReportsRepository,
	minioStore *storage.MinIOStore,
	db *pgxpool.Pool,
) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /cases/{caseId}/evidences", requireAuth(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleUpload(w, r, evidences, minioStore)
		}),
	).ServeHTTP)

	mux.HandleFunc("GET /cases/{caseId}/evidences", requireAuth(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleList(w, r, evidences)
		}),
	).ServeHTTP)

	mux.HandleFunc("GET /cases/{caseId}/findings", requireAuth(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleListFindings(w, r, findings)
		}),
	).ServeHTTP)

	// HU-22: generate report
	mux.HandleFunc("POST /cases/{caseId}/report", requireAuth(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleGenerateReport(w, r, reports, minioStore)
		}),
	).ServeHTTP)

	// HU-23: get latest report metadata + presigned URL
	mux.HandleFunc("GET /cases/{caseId}/report", requireAuth(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleGetReport(w, r, reports, minioStore)
		}),
	).ServeHTTP)

	// HU-25: real-time case event stream (SSE)
	mux.HandleFunc("GET /cases/{caseId}/stream", requireAuth(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleCaseStream(w, r, db)
		}),
	).ServeHTTP)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	return loggingMiddleware(mux)
}

// ─── Upload handler (HU-11 + HU-12 + HU-13) ──────────────────────────────────

func handleUpload(
	w http.ResponseWriter,
	r *http.Request,
	evidences *storage.EvidenceRepository,
	minioStore *storage.MinIOStore,
) {
	actor := actorFromRequest(r)
	caseID := r.PathValue("caseId")

	// Parse multipart — limit to MaxFileSize + 1 to detect oversize files.
	if err := r.ParseMultipartForm(domain.MaxFileSize + 1); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to parse multipart form"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "field 'file' is required"})
		return
	}
	defer file.Close()

	// HU-12: size check
	if header.Size > domain.MaxFileSize {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{
			"error": fmt.Sprintf("file exceeds maximum size of %d MB", domain.MaxFileSize/1024/1024),
		})
		return
	}

	// HU-12: MIME type check — use header value first, then sniff first 512 bytes
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		buf := make([]byte, 512)
		n, _ := file.Read(buf)
		mimeType = http.DetectContentType(buf[:n])
		// Seek back to start
		if seeker, ok := file.(io.Seeker); ok {
			_, _ = seeker.Seek(0, io.SeekStart)
		}
	}

	if !domain.IsAllowedMIME(mimeType) {
		writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{
			"error": fmt.Sprintf("MIME type '%s' is not supported", mimeType),
		})
		return
	}

	// Read file into buffer to compute SHA-256 hash and then upload to MinIO.
	data, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
		return
	}

	// HU-12: integrity hash
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])

	// HU-12: duplicate detection within the same case
	exists, err := evidences.ExistsByHash(r.Context(), caseID, hash)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
		return
	}
	if exists {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "an identical file already exists in this case",
		})
		return
	}

	// HU-13: classify file type from MIME
	fileType := domain.ClassifyMIME(mimeType)

	// Build storage path: cases/<caseID>/<hash>/<originalFilename>
	safeName := sanitizeFilename(header.Filename)
	storagePath := fmt.Sprintf("cases/%s/%s/%s", caseID, hash[:16], safeName)

	// Upload to MinIO
	if err := minioStore.PutObject(r.Context(), storagePath, mimeType, strings.NewReader(string(data)), int64(len(data))); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage upload failed"})
		return
	}

	// Persist metadata
	ev, err := evidences.Create(r.Context(), domain.CreateEvidenceInput{
		CaseID:           caseID,
		OriginalFilename: header.Filename,
		FileType:         fileType,
		MIMEType:         mimeType,
		StoragePath:      storagePath,
		SizeBytes:        int64(len(data)),
		HashSHA256:       hash,
		UploadedBy:       actor.ID,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save evidence"})
		return
	}

	writeJSON(w, http.StatusCreated, ev)
}

// ─── List handler ─────────────────────────────────────────────────────────────

func handleList(w http.ResponseWriter, r *http.Request, evidences *storage.EvidenceRepository) {
	caseID := r.PathValue("caseId")

	list, err := evidences.List(r.Context(), caseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list evidences"})
		return
	}

	if list == nil {
		list = []domain.Evidence{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"evidences": list, "total": len(list)})
}

// ─── Findings handler ─────────────────────────────────────────────────────────

func handleListFindings(w http.ResponseWriter, r *http.Request, findings *storage.FindingsRepository) {
	caseID     := r.PathValue("caseId")
	evidenceID := r.URL.Query().Get("evidence_id")

	list, err := findings.ListByCaseID(r.Context(), caseID, evidenceID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list findings"})
		return
	}
	if list == nil {
		list = []domain.Finding{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"findings": list, "total": len(list)})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// sanitizeFilename strips path traversal characters from a filename.
func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", "")
	name = strings.ReplaceAll(name, "/", "")
	name = strings.ReplaceAll(name, "\\", "")
	if name == "" || name == "." {
		name = "file"
	}
	return name
}
