CREATE TABLE report_schedules (
  business TEXT PRIMARY KEY NOT NULL,
  recipient TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'daily',
  send_time TEXT NOT NULL DEFAULT '09:00',
  time_zone TEXT NOT NULL DEFAULT 'America/Denver',
  weekday INTEGER NOT NULL DEFAULT 1,
  next_run TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX reports_due ON report_schedules (enabled, next_run);

CREATE TABLE report_runs (
  id TEXT PRIMARY KEY NOT NULL,
  business TEXT NOT NULL,
  recipient TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt TEXT,
  lease_until TEXT,
  error TEXT,
  provider_id TEXT
);

CREATE INDEX report_runs_business ON report_runs (business, created_at);

CREATE INDEX report_runs_pending ON report_runs (status, next_attempt);
