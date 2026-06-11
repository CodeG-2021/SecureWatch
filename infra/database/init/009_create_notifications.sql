CREATE TABLE IF NOT EXISTS notifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    finding_id  UUID        REFERENCES findings(id) ON DELETE SET NULL,
    title       TEXT        NOT NULL,
    message     TEXT        NOT NULL,
    severity    VARCHAR(20) NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_case_id   ON notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at   ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
