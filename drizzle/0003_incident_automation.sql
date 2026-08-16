ALTER TABLE projects ADD COLUMN last_state TEXT NOT NULL DEFAULT 'HEALTHY';
ALTER TABLE projects ADD COLUMN consecutive_outage_runs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN shadow_mode INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN automatic_suspension INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN snapshot_json TEXT;

CREATE TABLE IF NOT EXISTS incident_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  state TEXT NOT NULL,
  should_suspend INTEGER NOT NULL,
  consecutive_outage_runs INTEGER NOT NULL,
  shadow_mode INTEGER NOT NULL,
  evidence_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS incident_evaluations_pool_time ON incident_evaluations(pool_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS recovery_capsules (
  recovery_root TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  capsule_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS recovery_capsules_incident ON recovery_capsules(incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_investigations (
  investigation_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  model TEXT NOT NULL,
  valid INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  validation_json TEXT NOT NULL
);

