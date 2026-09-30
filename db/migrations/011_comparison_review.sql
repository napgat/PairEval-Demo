-- Instructor decisions append a record; original submissions and prior snapshots remain intact.
CREATE TABLE IF NOT EXISTS comparison_review_decision (
  id uuid PRIMARY KEY,
  pair_assignment_id uuid NOT NULL REFERENCES pair_assignment(id),
  excluded boolean NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comparison_review_latest_idx
  ON comparison_review_decision (pair_assignment_id,created_at DESC,id DESC);
CREATE OR REPLACE VIEW latest_comparison_review AS
SELECT DISTINCT ON (pair_assignment_id) * FROM comparison_review_decision
ORDER BY pair_assignment_id,created_at DESC,id DESC;
