ALTER TABLE projects ADD COLUMN coordinator_address TEXT;
ALTER TABLE projects ADD COLUMN registry_address TEXT;

CREATE TABLE IF NOT EXISTS execution_queue (
  action_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  transaction_hash TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS execution_queue_status ON execution_queue(status, created_at);
