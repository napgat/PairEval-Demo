-- Prototype-only timing/cohort data and durable scheduled score idempotency.
CREATE TABLE IF NOT EXISTS synthetic_quality_cohort (
  classroom_id uuid PRIMARY KEY REFERENCES classroom(id),
  provenance text NOT NULL CHECK (length(btrim(provenance))>=10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS synthetic_close_friend (
  classroom_id uuid NOT NULL REFERENCES synthetic_quality_cohort(classroom_id),
  evaluator_user_id uuid NOT NULL REFERENCES app_user(id),
  friend_user_id uuid NOT NULL REFERENCES app_user(id),
  provenance text NOT NULL CHECK (length(btrim(provenance))>=10),
  PRIMARY KEY (classroom_id,evaluator_user_id,friend_user_id),
  CHECK (evaluator_user_id<>friend_user_id)
);
CREATE TABLE IF NOT EXISTS evaluation_active_session (
  id uuid PRIMARY KEY,
  pair_assignment_id uuid NOT NULL REFERENCES pair_assignment(id),
  evaluator_user_id uuid NOT NULL REFERENCES app_user(id),
  generation integer NOT NULL,
  active_ms integer NOT NULL DEFAULT 0 CHECK (active_ms BETWEEN 0 AND 86400000),
  last_sequence integer NOT NULL DEFAULT 0 CHECK (last_sequence>=0),
  last_delta_ms integer NOT NULL DEFAULT 0,
  closed boolean NOT NULL DEFAULT false,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_event_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS active_session_pair_idx ON evaluation_active_session(pair_assignment_id,evaluator_user_id,generation);
ALTER TABLE submission_answer ADD COLUMN IF NOT EXISTS active_duration_ms integer
  CHECK (active_duration_ms BETWEEN 0 AND 86400000);

INSERT INTO app_user (id,email_lookup,email_raw,display_name,status)
VALUES ('00000000-0000-4000-8000-000000000026','score-scheduler@system.invalid','score-scheduler@system.invalid','Scheduled score service','DISABLED')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS scheduled_score_run (
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  generation integer NOT NULL,
  local_date date NOT NULL,
  timezone text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  snapshot_id uuid NOT NULL REFERENCES score_snapshot(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (assignment_id,generation,local_date),
  FOREIGN KEY (assignment_id,generation) REFERENCES assignment_generation(assignment_id,generation)
);
CREATE TABLE IF NOT EXISTS score_job_invocation (
  id uuid PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('VERCEL_CRON','MANUAL')),
  slot text NOT NULL,
  status text NOT NULL CHECK (status IN ('STARTED','COMPLETED','FAILED')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  result_json jsonb
);
