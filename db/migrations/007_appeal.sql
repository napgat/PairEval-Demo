-- Day 5 synthetic prototype: one open appeal per student and assignment.
CREATE TABLE IF NOT EXISTS appeal (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  student_user_id uuid NOT NULL REFERENCES app_user(id),
  final_snapshot_id uuid NOT NULL REFERENCES score_snapshot(id),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 20 AND 4000),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','REJECTED')),
  resolution text,
  resolved_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((status='OPEN') = (resolved_at IS NULL)),
  CHECK (status='OPEN' OR length(btrim(resolution)) BETWEEN 10 AND 4000)
);
CREATE UNIQUE INDEX IF NOT EXISTS appeal_one_open_per_student
  ON appeal (assignment_id,student_user_id) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS appeal_assignment_time_idx ON appeal (assignment_id,created_at DESC);
