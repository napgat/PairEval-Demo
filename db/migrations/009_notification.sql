-- In-app synthetic notification channel. No email or push delivery is configured.
CREATE TABLE IF NOT EXISTS app_notification (
  id uuid PRIMARY KEY,
  recipient_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignment(id) ON DELETE CASCADE,
  generation integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN
    ('ASSIGNMENT_PUBLISHED','PAIRS_REGENERATED','DEADLINE_48H_GROUP',
     'DEADLINE_48H_INDIVIDUAL','SCORE_FINALIZED','EXTRA_EVALUATOR')),
  dedupe_key text NOT NULL UNIQUE,
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 200),
  deep_link text NOT NULL CHECK (deep_link LIKE '/full-system/%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_notification_recipient_idx
  ON app_notification (recipient_user_id, created_at DESC, id DESC);
