-- v2.0 becomes the versioned source of truth. Never merge colliding identities silently.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM app_user GROUP BY
      regexp_replace(split_part(split_part(lower(btrim(email_raw)),'@',1),'+',1),'\.','','g')
      || '@' || split_part(lower(btrim(email_raw)),'@',2)
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'PRD v2.0 email aliases collide; resolve identities before migration'; END IF;
END $$;
UPDATE app_user SET email_lookup =
  regexp_replace(split_part(split_part(lower(btrim(email_raw)),'@',1),'+',1),'\.','','g')
  || '@' || split_part(lower(btrim(email_raw)),'@',2);
ALTER TABLE audit_outbox ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE assignment ALTER COLUMN scoring_formula_version SET DEFAULT 'prd-v2.0-1';
-- Existing snapshots keep their recorded version; only new calculations get the new baseline.
UPDATE assignment SET scoring_formula_version='prd-v2.0-1' WHERE status<>'FINALIZED';
