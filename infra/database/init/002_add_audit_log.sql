-- Fix status constraint to use 'inactive' instead of 'disabled'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('active', 'inactive', 'suspended'));

-- Audit log table for tracking role changes and other sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID NOT NULL REFERENCES users(id),
    actor_email TEXT NOT NULL,
    action      TEXT NOT NULL,
    target_id   UUID REFERENCES users(id),
    target_email TEXT,
    old_value   TEXT,
    new_value   TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target  ON audit_log (target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
