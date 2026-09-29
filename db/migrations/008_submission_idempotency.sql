-- Carry-over from Day 4: one submission revision per evaluator/idempotency key.
ALTER TABLE submission_revision ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE submission_revision DROP CONSTRAINT IF EXISTS submission_revision_idempotency_key_length;
ALTER TABLE submission_revision ADD CONSTRAINT submission_revision_idempotency_key_length
  CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 8 AND 128);
CREATE UNIQUE INDEX IF NOT EXISTS submission_evaluator_idempotency_unique
  ON submission_revision (evaluator_user_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
