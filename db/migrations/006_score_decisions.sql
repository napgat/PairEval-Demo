-- Day 5: immutable score runs and explicit instructor decisions.
CREATE TABLE IF NOT EXISTS score_snapshot (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  generation integer NOT NULL,
  snapshot_no integer NOT NULL CHECK (snapshot_no > 0),
  kind text NOT NULL CHECK (kind IN ('INTERIM','FINAL')),
  formula_version text NOT NULL,
  config_json jsonb NOT NULL,
  input_json jsonb NOT NULL,
  input_hash text NOT NULL CHECK (length(input_hash) = 64),
  output_json jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assignment_id,generation) REFERENCES assignment_generation(assignment_id,generation),
  UNIQUE (assignment_id,snapshot_no)
);
CREATE INDEX IF NOT EXISTS score_snapshot_latest_idx
  ON score_snapshot (assignment_id,snapshot_no DESC);

CREATE TABLE IF NOT EXISTS score_snapshot_item (
  id uuid PRIMARY KEY,
  score_snapshot_id uuid NOT NULL REFERENCES score_snapshot(id),
  criterion_id uuid NOT NULL REFERENCES criterion(id),
  side text NOT NULL CHECK (side IN ('GROUP','INDIVIDUAL')),
  item_id uuid NOT NULL,
  comparison_count integer NOT NULL CHECK (comparison_count >= 0),
  quality_index numeric(8,6),
  weighted_score numeric(10,4),
  flags text[] NOT NULL DEFAULT '{}',
  UNIQUE (score_snapshot_id,criterion_id,side,item_id)
);

CREATE TABLE IF NOT EXISTS score_override (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  generation integer NOT NULL,
  side text NOT NULL CHECK (side IN ('GROUP','INDIVIDUAL')),
  item_id uuid NOT NULL,
  original_value numeric(10,4),
  override_value numeric(10,4) NOT NULL CHECK (override_value >= 0),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assignment_id,generation) REFERENCES assignment_generation(assignment_id,generation)
);
CREATE INDEX IF NOT EXISTS score_override_latest_idx
  ON score_override (assignment_id,generation,side,item_id,created_at DESC,id DESC);
