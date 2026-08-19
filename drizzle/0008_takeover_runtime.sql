CREATE TABLE IF NOT EXISTS rwa_checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  from_block TEXT NOT NULL,
  to_block TEXT NOT NULL,
  confirmation_block TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  checkpoint_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rwa_checkpoints_project_time ON rwa_checkpoints(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rwa_account_states (
  project_id TEXT NOT NULL,
  account TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  principal TEXT NOT NULL,
  yield_amount TEXT NOT NULL,
  pending_redemption TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(project_id, account)
);

CREATE TABLE IF NOT EXISTS rwa_redemptions (
  request_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  account TEXT NOT NULL,
  amount TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL,
  governance_status TEXT NOT NULL,
  execution_status TEXT NOT NULL,
  transaction_hash TEXT,
  conflict_reason TEXT
);
CREATE INDEX IF NOT EXISTS rwa_redemptions_project_queue ON rwa_redemptions(project_id, priority DESC, requested_at ASC);

CREATE TABLE IF NOT EXISTS rwa_decision_traces (
  run_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  model TEXT NOT NULL,
  verifier_model TEXT NOT NULL,
  status TEXT NOT NULL,
  capsule_hash TEXT,
  trace_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rwa_decision_traces_project_time ON rwa_decision_traces(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rwa_disputes (
  dispute_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  account TEXT,
  evidence_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
