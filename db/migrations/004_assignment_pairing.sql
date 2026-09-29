-- Additive Full System Day 3 assignment artifacts and immutable pairing generations.
ALTER TABLE assignment ADD COLUMN IF NOT EXISTS artifact_overview_url text;
ALTER TABLE criterion ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE criterion DROP CONSTRAINT IF EXISTS criterion_assignment_id_side_display_order_key;
CREATE UNIQUE INDEX IF NOT EXISTS criterion_active_order_unique
  ON criterion (assignment_id, side, display_order) WHERE active;

CREATE TABLE IF NOT EXISTS group_artifact (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  group_id uuid NOT NULL REFERENCES group_entity(id),
  artifact_url text NOT NULL,
  display_label text,
  UNIQUE (assignment_id, group_id)
);
CREATE TABLE IF NOT EXISTS individual_artifact (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  student_user_id uuid NOT NULL REFERENCES app_user(id),
  artifact_url text NOT NULL,
  display_label text,
  UNIQUE (assignment_id, student_user_id)
);

CREATE TABLE IF NOT EXISTS assignment_generation (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  generation integer NOT NULL CHECK (generation >= 1),
  seed text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','INVALIDATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  invalidated_reason text,
  UNIQUE (assignment_id, generation),
  CHECK ((status = 'INVALIDATED') = (invalidated_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS assignment_one_active_generation
  ON assignment_generation (assignment_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS pair_assignment (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  criterion_id uuid NOT NULL REFERENCES criterion(id),
  side text NOT NULL CHECK (side IN ('GROUP','INDIVIDUAL')),
  group_a_id uuid REFERENCES group_entity(id),
  group_b_id uuid REFERENCES group_entity(id),
  student_a_id uuid REFERENCES app_user(id),
  student_b_id uuid REFERENCES app_user(id),
  evaluator_user_id uuid NOT NULL REFERENCES app_user(id),
  display_left text NOT NULL CHECK (display_left IN ('A','B')),
  left_artifact_url text,
  right_artifact_url text,
  generation integer NOT NULL,
  source text NOT NULL DEFAULT 'AUTO' CHECK (source IN ('AUTO','INSTRUCTOR_EXTRA','INSTRUCTOR_SELF')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assignment_id, generation) REFERENCES assignment_generation(assignment_id, generation),
  CHECK ((side = 'GROUP' AND group_a_id < group_b_id AND student_a_id IS NULL AND student_b_id IS NULL)
      OR (side = 'INDIVIDUAL' AND student_a_id < student_b_id AND group_a_id IS NULL AND group_b_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS pair_group_unique ON pair_assignment
  (assignment_id,criterion_id,generation,group_a_id,group_b_id,evaluator_user_id) WHERE side='GROUP';
CREATE UNIQUE INDEX IF NOT EXISTS pair_individual_unique ON pair_assignment
  (assignment_id,criterion_id,generation,student_a_id,student_b_id,evaluator_user_id) WHERE side='INDIVIDUAL';
CREATE INDEX IF NOT EXISTS pair_evaluator_assignment_idx ON pair_assignment (evaluator_user_id,assignment_id);
