-- Operator-managed academic calendar. The collection academic year counts as year one.
CREATE TABLE privacy_retention_policy(id boolean PRIMARY KEY DEFAULT true CHECK(id),academic_start_month integer NOT NULL CHECK(academic_start_month BETWEEN 1 AND 12));
INSERT INTO privacy_retention_policy VALUES(true,8);
GRANT SELECT ON privacy_retention_policy TO paireval_operational_app;
CREATE FUNCTION privacy_expiry_cutoff(years integer) RETURNS timestamptz LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT make_timestamptz(extract(year FROM now())::integer-CASE WHEN extract(month FROM now())<academic_start_month THEN 1 ELSE 0 END-years+1,academic_start_month,1,0,0,0,'UTC') FROM privacy_retention_policy WHERE id
$$;
CREATE OR REPLACE FUNCTION anonymize_expired_identity(target uuid, cutoff timestamptz, alias text, replacements jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u app_user%ROWTYPE; s record; redacted jsonb; new_hash text;
BEGIN
 IF cutoff>privacy_expiry_cutoff(2) OR alias !~ '^retained-[a-f0-9]{24}$' THEN RAISE EXCEPTION 'Invalid retention policy'; END IF;
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
 IF cutoff>privacy_expiry_cutoff(1) THEN RAISE EXCEPTION 'Timing retention is one year'; END IF;
 UPDATE submission_answer SET active_duration_ms=NULL WHERE active_duration_ms IS NOT NULL AND revision_id IN
  (SELECT id FROM submission_revision WHERE submitted_at<cutoff);
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM evaluation_active_session WHERE last_event_at<cutoff;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION expire_active_timing(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_active_timing(timestamptz) TO paireval_operational_app;
