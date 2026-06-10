-- Migration 004: Evidence module
-- Supports HU-11 (upload), HU-12 (validate), HU-13 (classify)

CREATE TABLE IF NOT EXISTS evidences (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id           UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    original_filename TEXT        NOT NULL,
    file_type         TEXT        NOT NULL DEFAULT 'unknown'
                                  CHECK (file_type IN ('text', 'image', 'audio', 'document', 'archive', 'unknown')),
    mime_type         TEXT        NOT NULL,
    storage_path      TEXT        NOT NULL,
    size_bytes        BIGINT      NOT NULL,
    hash_sha256       TEXT        NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'uploaded'
                                  CHECK (status IN ('uploaded', 'classified', 'queued', 'processing', 'completed', 'failed')),
    uploaded_by       UUID        NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplication: prevent uploading the same file (by hash) twice to the same case
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidences_case_hash ON evidences(case_id, hash_sha256);

CREATE INDEX IF NOT EXISTS idx_evidences_case_id    ON evidences(case_id);
CREATE INDEX IF NOT EXISTS idx_evidences_status     ON evidences(status);
CREATE INDEX IF NOT EXISTS idx_evidences_file_type  ON evidences(file_type);
CREATE INDEX IF NOT EXISTS idx_evidences_created_at ON evidences(created_at DESC);
