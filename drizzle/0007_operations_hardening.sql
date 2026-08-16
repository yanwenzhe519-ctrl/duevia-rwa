ALTER TABLE projects ADD COLUMN observer_endpoints_json TEXT;
ALTER TABLE keeper_runs ADD COLUMN trigger_source TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE keeper_runs ADD COLUMN lease_holder TEXT;

CREATE TABLE IF NOT EXISTS servicer_feed_receipts (
  replay_key TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  recovery_root TEXT NOT NULL,
  policy_state TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS servicer_feed_receipts_pool_time
ON servicer_feed_receipts(pool_id, received_at DESC);
