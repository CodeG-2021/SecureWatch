-- Migration 003: Cases module
-- Supports HU-07 (create), HU-08 (list), HU-09 (detail), HU-10 (update)

CREATE TABLE IF NOT EXISTS cases (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    description TEXT,
    priority    TEXT        NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status      TEXT        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'in_progress', 'closed', 'archived')),
    created_by  UUID        NOT NULL REFERENCES users(id),
    assigned_to UUID        REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cases_status      ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority    ON cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_created_by  ON cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_created_at  ON cases(created_at DESC);
