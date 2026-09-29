-- Transactional delivery queue for separately stored audit outcomes.
-- The audit_event table in the separate audit database remains authoritative.
CREATE TABLE IF NOT EXISTS audit_outbox (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  classroom_id uuid,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action ~ '_(COMMITTED|REJECTED)$'),
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS audit_outbox_pending_idx ON audit_outbox (created_at, id)
  WHERE delivered_at IS NULL;
