-- HU-21: Add risk_score to cases for consolidated risk calculation
ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS findings_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN cases.risk_score IS
    'Weighted risk score 0-100: (critical*4 + high*3 + medium*2 + low*1) / (total*4) * 100';
COMMENT ON COLUMN cases.findings_count IS
    'Denormalized count of findings for this case';
