-- Apply to a SEPARATE audit PostgreSQL database with an owner/admin connection.
-- The application role must receive SELECT/INSERT only; never owner, UPDATE, DELETE or TRUNCATE.
CREATE TABLE IF NOT EXISTS audit_event (
  id uuid PRIMARY KEY,
  classroom_id uuid NOT NULL,
  assignment_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  reason text,
  ip_address inet,
  request_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_event_scope_time_idx ON audit_event (classroom_id, occurred_at DESC);
-- Grant only after creating a distinct non-owner application role, for example:
-- REVOKE ALL ON audit_event FROM PUBLIC;
-- GRANT SELECT, INSERT ON audit_event TO <audit_app_role>;
-- Database ownership and integrity/retention controls require an approved account setup.
