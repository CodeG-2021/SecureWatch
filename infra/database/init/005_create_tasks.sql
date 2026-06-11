-- Migration 005: Task Orchestrator
-- Supports HU-14 (create tasks) and HU-15 (queue tasks)

CREATE TABLE IF NOT EXISTS tasks (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id   UUID        NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
    task_type     TEXT        NOT NULL
                              CHECK (task_type IN ('text_analysis','image_analysis','audio_analysis','document_analysis','archive_analysis')),
    queue_name    TEXT        NOT NULL,
    priority      TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low','medium','high','critical')),
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','queued','processing','completed','failed','retrying','cancelled','dead_letter')),
    retry_count   INT         NOT NULL DEFAULT 0,
    max_retries   INT         NOT NULL DEFAULT 3,
    worker_id     TEXT,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    failed_at     TIMESTAMPTZ,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_evidence_id  ON tasks(evidence_id);
CREATE INDEX IF NOT EXISTS idx_tasks_case_id      ON tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority     ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at   ON tasks(created_at DESC);
