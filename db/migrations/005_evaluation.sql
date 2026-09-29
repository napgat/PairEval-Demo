-- Full System evaluation drafts and immutable submitted revisions.
CREATE TABLE IF NOT EXISTS evaluation_draft (
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  evaluator_user_id uuid NOT NULL REFERENCES app_user(id),
  side text NOT NULL CHECK (side IN ('GROUP','INDIVIDUAL')),
  generation integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id,evaluator_user_id,side,generation),
  FOREIGN KEY (assignment_id,generation) REFERENCES assignment_generation(assignment_id,generation)
);
CREATE TABLE IF NOT EXISTS evaluation_draft_answer (
  assignment_id uuid NOT NULL,
  evaluator_user_id uuid NOT NULL,
  side text NOT NULL,
  generation integer NOT NULL,
  pair_assignment_id uuid NOT NULL REFERENCES pair_assignment(id),
  choice smallint NOT NULL CHECK (choice BETWEEN 1 AND 6),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id,evaluator_user_id,side,generation,pair_assignment_id),
  FOREIGN KEY (assignment_id,evaluator_user_id,side,generation)
    REFERENCES evaluation_draft(assignment_id,evaluator_user_id,side,generation)
);
CREATE TABLE IF NOT EXISTS submission_revision (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  evaluator_user_id uuid NOT NULL REFERENCES app_user(id),
  side text NOT NULL CHECK (side IN ('GROUP','INDIVIDUAL')),
  generation integer NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assignment_id,generation) REFERENCES assignment_generation(assignment_id,generation),
  UNIQUE (assignment_id,evaluator_user_id,side,generation,revision_number)
);
CREATE INDEX IF NOT EXISTS submission_latest_idx ON submission_revision
  (assignment_id,evaluator_user_id,side,generation,revision_number DESC);
CREATE TABLE IF NOT EXISTS submission_answer (
  revision_id uuid NOT NULL REFERENCES submission_revision(id),
  pair_assignment_id uuid NOT NULL REFERENCES pair_assignment(id),
  choice smallint NOT NULL CHECK (choice BETWEEN 1 AND 6),
  PRIMARY KEY (revision_id,pair_assignment_id)
);
