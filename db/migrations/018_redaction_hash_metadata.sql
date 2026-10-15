-- Privacy redactions preserve the original hash in the append-only redaction record.
-- The replacement hash explicitly names PostgreSQL's serialization algorithm.
ALTER TABLE score_snapshot ADD COLUMN input_hash_algorithm text NOT NULL DEFAULT 'sha256-json-stringify-v1';
ALTER TABLE privacy_redaction ADD COLUMN hash_algorithm text NOT NULL DEFAULT 'sha256-postgresql-jsonb-text-v1';
UPDATE score_snapshot s SET input_hash_algorithm='sha256-postgresql-jsonb-text-v1'
 WHERE EXISTS(SELECT 1 FROM privacy_redaction r WHERE r.snapshot_id=s.id);
CREATE FUNCTION mark_redacted_snapshot_hash() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE score_snapshot SET input_hash_algorithm=NEW.hash_algorithm WHERE id=NEW.snapshot_id;
 RETURN NEW;
END $$;
CREATE TRIGGER privacy_hash_algorithm AFTER INSERT ON privacy_redaction
 FOR EACH ROW EXECUTE FUNCTION mark_redacted_snapshot_hash();
REVOKE INSERT ON privacy_redaction FROM paireval_operational_app;
