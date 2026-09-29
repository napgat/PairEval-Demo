-- Day 2 operational additions. No Demo SQLite objects are modified.
ALTER TABLE classroom_member ADD COLUMN IF NOT EXISTS student_number text;
ALTER TABLE classroom ADD COLUMN IF NOT EXISTS roster_version integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS classroom_member_student_number_unique
  ON classroom_member (classroom_id, student_number) WHERE student_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_session (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user(id),
  token_hash char(64) NOT NULL UNIQUE,
  hosted_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS app_session_user_active_idx ON app_session (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS privacy_notice_acceptance (
  user_id uuid PRIMARY KEY REFERENCES app_user(id),
  notice_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
