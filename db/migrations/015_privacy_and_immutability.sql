ALTER TABLE app_user ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
CREATE TABLE IF NOT EXISTS privacy_data_request (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('COPY')), status text NOT NULL CHECK(status IN ('PENDING','COMPLETED')),
 requested_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 completed_at timestamptz, CHECK((status='COMPLETED')=(completed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS privacy_redaction (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id),
 snapshot_id uuid NOT NULL REFERENCES score_snapshot(id) ON DELETE CASCADE,
 previous_input_hash text NOT NULL, redacted_input_hash text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='paireval_operational_app') THEN
  CREATE ROLE paireval_operational_app NOLOGIN;
 END IF;
END $$;
GRANT paireval_operational_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO paireval_operational_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO paireval_operational_app;
REVOKE UPDATE,DELETE,TRUNCATE ON score_snapshot,score_snapshot_item,score_override,submission_revision,
 submission_answer,comparison_review_decision,privacy_redaction FROM paireval_operational_app;

CREATE OR REPLACE FUNCTION privacy_redact_json(value jsonb, replacements jsonb) RETURNS jsonb
 LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE output jsonb; content text; k text; v text;
BEGIN
 IF jsonb_typeof(value)='object' THEN
  SELECT coalesce(jsonb_object_agg(key,privacy_redact_json(val,replacements)),'{}') INTO output FROM jsonb_each(value) AS e(key,val);
 ELSIF jsonb_typeof(value)='array' THEN
  SELECT coalesce(jsonb_agg(privacy_redact_json(val,replacements)),'[]') INTO output FROM jsonb_array_elements(value) AS e(val);
 ELSIF jsonb_typeof(value)='string' THEN
  content:=value#>>'{}';
  FOR k,v IN SELECT key,val FROM jsonb_each_text(replacements) AS e(key,val) LOOP
   IF content=k THEN content:=v; ELSIF length(k)>=3 THEN content:=replace(content,k,v); END IF;
  END LOOP;
  output:=to_jsonb(content);
 ELSE output:=value;
 END IF;
 RETURN output;
END $$;

-- A fixed, server-time retention predicate is enforced again in the database.
-- Only identity strings change; score numbers, revisions, pair IDs and counts remain intact.
CREATE OR REPLACE FUNCTION anonymize_expired_identity(target uuid, cutoff timestamptz, alias text, replacements jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u app_user%ROWTYPE; s record; redacted jsonb; new_hash text;
BEGIN
 IF cutoff>now()-interval '2 years' OR alias !~ '^retained-[a-f0-9]{24}$' THEN RAISE EXCEPTION 'Invalid retention policy'; END IF;
 SELECT * INTO u FROM app_user WHERE id=target FOR UPDATE;
 IF NOT FOUND OR u.anonymized_at IS NOT NULL THEN RETURN; END IF;
 IF u.created_at>=cutoff OR coalesce(u.last_login_at,u.created_at)>=cutoff
  OR EXISTS(SELECT FROM classroom_member m JOIN assignment a ON a.classroom_id=m.classroom_id
   WHERE m.user_id=target AND greatest(a.created_at,a.group_deadline_utc,a.individual_deadline_utc,a.finalized_at)>=cutoff)
  OR EXISTS(SELECT FROM submission_revision WHERE evaluator_user_id=target AND submitted_at>=cutoff)
  OR EXISTS(SELECT FROM app_session WHERE user_id=target AND revoked_at IS NULL AND expires_at>now())
 THEN RAISE EXCEPTION 'Identity still within retention'; END IF;
 -- Reject caller-supplied mappings for unrelated identities.
 IF EXISTS(SELECT FROM jsonb_each_text(replacements) e WHERE e.key NOT IN
  (u.email_raw,u.email_lookup,u.display_name,coalesce(u.google_sub,'')) OR e.value<>alias) THEN
  RAISE EXCEPTION 'Invalid identity redaction mapping'; END IF;
 FOR s IN SELECT id,input_json,input_hash FROM score_snapshot WHERE input_json::text LIKE '%'||target::text||'%' OR output_json::text LIKE '%'||target::text||'%' LOOP
  redacted:=privacy_redact_json(s.input_json,replacements);
  new_hash:=encode(sha256(convert_to(redacted::text,'UTF8')),'hex');
  UPDATE score_snapshot SET input_json=redacted,input_hash=new_hash,output_json=privacy_redact_json(output_json,replacements) WHERE id=s.id;
  INSERT INTO privacy_redaction(id,user_id,snapshot_id,previous_input_hash,redacted_input_hash)
   VALUES(gen_random_uuid(),target,s.id,s.input_hash,new_hash);
 END LOOP;
 UPDATE app_user SET email_raw=alias||'@anonymized.invalid',email_lookup=alias||'@anonymized.invalid',
  display_name=alias,google_sub=NULL,status='DISABLED',anonymized_at=now() WHERE id=target;
 UPDATE classroom_member SET student_number=NULL WHERE user_id=target;
 UPDATE app_session SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=target;
 UPDATE appeal SET message=privacy_redact_json(to_jsonb(message),replacements)#>>'{}',
  resolution=privacy_redact_json(to_jsonb(resolution),replacements)#>>'{}' WHERE student_user_id=target;
END $$;
REVOKE ALL ON FUNCTION anonymize_expired_identity(uuid,timestamptz,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anonymize_expired_identity(uuid,timestamptz,text,jsonb) TO paireval_operational_app;

CREATE OR REPLACE FUNCTION expire_active_timing(cutoff timestamptz) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 IF cutoff>now()-interval '1 year' THEN RAISE EXCEPTION 'Timing retention is one year'; END IF;
 UPDATE submission_answer SET active_duration_ms=NULL WHERE active_duration_ms IS NOT NULL AND revision_id IN
  (SELECT id FROM submission_revision WHERE submitted_at<cutoff);
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM evaluation_active_session WHERE last_event_at<cutoff;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION expire_active_timing(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_active_timing(timestamptz) TO paireval_operational_app;
