CREATE TABLE IF NOT EXISTS keeper_leases (
  lease_id TEXT PRIMARY KEY,
  holder TEXT,
  lease_until TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO keeper_leases (lease_id, holder, lease_until, updated_at)
VALUES ('xlayer-1952', NULL, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z');
