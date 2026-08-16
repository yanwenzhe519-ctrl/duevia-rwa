CREATE TABLE IF NOT EXISTS projects (
  pool_id TEXT PRIMARY KEY,
  servicer_id TEXT NOT NULL,
  contract_address TEXT,
  sla_hours INTEGER NOT NULL DEFAULT 24,
  grace_hours INTEGER NOT NULL DEFAULT 6,
  last_heartbeat_at TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  observation_id TEXT PRIMARY KEY,
  pool_id TEXT,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  block_number TEXT,
  transaction_hash TEXT,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS observations_pool_time ON observations(pool_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  servicer_id TEXT NOT NULL,
  state TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  recovery_root TEXT,
  evidence_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS incidents_pool_state ON incidents(pool_id, state);

CREATE TABLE IF NOT EXISTS keeper_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  from_block TEXT NOT NULL,
  to_block TEXT NOT NULL,
  observations INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS scanner_state (
  chain_id INTEGER PRIMARY KEY,
  last_scanned_block TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

