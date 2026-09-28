-- Initial operational schema for the Full System. Apply only to its PostgreSQL database.
CREATE TABLE IF NOT EXISTS app_seed_marker (
  id text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS db_smoke_probe (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_user (
  id uuid PRIMARY KEY,
  email_lookup text NOT NULL UNIQUE,
  email_raw text NOT NULL,
  display_name text NOT NULL,
  google_sub text UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','DISABLED')),
  platform_role text NOT NULL DEFAULT 'USER' CHECK (platform_role IN ('USER','SYSTEM_ADMIN')),
  can_create_classroom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CHECK (email_lookup = lower(btrim(email_lookup)))
);

CREATE TABLE IF NOT EXISTS classroom (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'Asia/Bangkok',
  allowed_email_domains text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_entity (
  id uuid PRIMARY KEY,
  classroom_id uuid NOT NULL REFERENCES classroom(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, name),
  UNIQUE (id, classroom_id)
);

CREATE TABLE IF NOT EXISTS classroom_member (
  id uuid PRIMARY KEY,
  classroom_id uuid NOT NULL REFERENCES classroom(id),
  user_id uuid NOT NULL REFERENCES app_user(id),
  role text NOT NULL CHECK (role IN ('OWNER','CO_TEACHER','TA','STUDENT')),
  group_id uuid,
  membership_status text NOT NULL DEFAULT 'ACTIVE' CHECK (membership_status IN ('ACTIVE','WITHDRAWN')),
  withdrawn_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, user_id),
  FOREIGN KEY (group_id, classroom_id) REFERENCES group_entity(id, classroom_id),
  CHECK ((role = 'STUDENT') = (group_id IS NOT NULL)),
  CHECK ((membership_status = 'WITHDRAWN') = (withdrawn_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS assignment (
  id uuid PRIMARY KEY,
  classroom_id uuid NOT NULL REFERENCES classroom(id),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  group_max_score numeric(6,2) NOT NULL DEFAULT 0 CHECK (group_max_score >= 0),
  individual_max_score numeric(6,2) NOT NULL DEFAULT 0 CHECK (individual_max_score >= 0),
  group_deadline_utc timestamptz,
  individual_deadline_utc timestamptz,
  instructor_weight numeric(4,2) NOT NULL DEFAULT 1 CHECK (instructor_weight >= 0),
  target_coverage integer NOT NULL DEFAULT 5 CHECK (target_coverage BETWEEN 1 AND 20),
  max_workload integer NOT NULL DEFAULT 8 CHECK (max_workload BETWEEN 1 AND 30),
  min_comparisons integer NOT NULL DEFAULT 3 CHECK (min_comparisons >= 1),
  score_floor numeric(4,3) NOT NULL DEFAULT 0.600,
  score_ceiling numeric(4,3) NOT NULL DEFAULT 1.000,
  completion_threshold numeric(4,3) NOT NULL DEFAULT 0.900,
  participation_scope text NOT NULL DEFAULT 'TOTAL' CHECK (participation_scope IN ('TOTAL','INDIVIDUAL')),
  scoring_formula_version text NOT NULL DEFAULT 'v2.1',
  pairing_seed bigint,
  generation integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','OPEN','CLOSED','FINALIZED','ARCHIVED')),
  published_at timestamptz,
  finalized_at timestamptz,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, slug),
  CHECK (score_floor >= 0 AND score_floor < score_ceiling AND score_ceiling <= 1),
  CHECK (completion_threshold BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS criterion (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignment(id),
  side text NOT NULL CHECK (side IN ('GROUP','INDIVIDUAL')),
  name text NOT NULL,
  description text,
  weight_pct numeric(5,2) NOT NULL CHECK (weight_pct BETWEEN 0 AND 100),
  display_order integer NOT NULL CHECK (display_order >= 0),
  UNIQUE (assignment_id, side, display_order)
);

-- Remaining PRD tables and the publish-time weight sum check follow in later migrations.
