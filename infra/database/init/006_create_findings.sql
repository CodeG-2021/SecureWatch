-- Migration 006: Findings (HU-16 to HU-19 output)
CREATE TABLE IF NOT EXISTS findings (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id      UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id  UUID        NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
    task_id      UUID        REFERENCES tasks(id) ON DELETE SET NULL,
    finding_type TEXT        NOT NULL,
    title        TEXT        NOT NULL,
    description  TEXT,
    severity     TEXT        NOT NULL DEFAULT 'low'
                             CHECK (severity IN ('low','medium','high','critical')),
    data         JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_case_id     ON findings(case_id);
CREATE INDEX IF NOT EXISTS idx_findings_evidence_id ON findings(evidence_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity    ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_type        ON findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_findings_created_at  ON findings(created_at DESC);
