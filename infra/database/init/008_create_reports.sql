-- HU-22: Report storage table
CREATE TABLE IF NOT EXISTS reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    generated_by    UUID NOT NULL REFERENCES users(id),
    storage_path    TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    summary         JSONB  NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_case_id    ON reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
