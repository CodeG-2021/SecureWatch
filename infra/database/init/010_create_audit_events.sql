-- Generic audit event log covering all services (HU-29).
-- Intentionally avoids FK constraints so any service can write without joining users table.
CREATE TABLE IF NOT EXISTS audit_events (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      TEXT        NOT NULL,
    actor_email   TEXT        NOT NULL,
    action        TEXT        NOT NULL,
    resource_type TEXT        NOT NULL,
    resource_id   TEXT,
    metadata      JSONB       DEFAULT '{}',
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at     ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id       ON audit_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource       ON audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action         ON audit_events (action);
