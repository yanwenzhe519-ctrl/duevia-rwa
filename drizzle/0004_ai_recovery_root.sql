ALTER TABLE ai_investigations ADD COLUMN recovery_root TEXT;
CREATE INDEX IF NOT EXISTS ai_investigations_root ON ai_investigations(incident_id, recovery_root);
