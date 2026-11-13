CREATE TABLE IF NOT EXISTS rsvps (
  guest_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  block_lot TEXT NOT NULL,
  coming TEXT NOT NULL,
  guests TEXT NOT NULL DEFAULT '',
  potluck TEXT NOT NULL DEFAULT '',
  suggestions TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  ip TEXT PRIMARY KEY,
  device TEXT NOT NULL,
  browser TEXT NOT NULL,
  place TEXT NOT NULL,
  visits INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_sessions (
  session_id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  reported_seconds INTEGER NOT NULL DEFAULT 0
);
