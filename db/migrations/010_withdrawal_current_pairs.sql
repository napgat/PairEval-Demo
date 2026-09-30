-- Preserve historical pairs/answers; current APIs use active roster membership only.
CREATE OR REPLACE VIEW active_pair_assignment AS
SELECT p.* FROM pair_assignment p
JOIN assignment a ON a.id=p.assignment_id
JOIN classroom_member e ON e.classroom_id=a.classroom_id AND e.user_id=p.evaluator_user_id
WHERE e.membership_status='ACTIVE'
  AND (p.side='GROUP' OR (
    EXISTS (SELECT 1 FROM classroom_member x WHERE x.classroom_id=a.classroom_id
      AND x.user_id=p.student_a_id AND x.role='STUDENT' AND x.membership_status='ACTIVE')
    AND EXISTS (SELECT 1 FROM classroom_member x WHERE x.classroom_id=a.classroom_id
      AND x.user_id=p.student_b_id AND x.role='STUDENT' AND x.membership_status='ACTIVE')))
  AND (p.side='INDIVIDUAL' OR (
    EXISTS (SELECT 1 FROM classroom_member x WHERE x.classroom_id=a.classroom_id
      AND x.group_id=p.group_a_id AND x.role='STUDENT' AND x.membership_status='ACTIVE')
    AND EXISTS (SELECT 1 FROM classroom_member x WHERE x.classroom_id=a.classroom_id
      AND x.group_id=p.group_b_id AND x.role='STUDENT' AND x.membership_status='ACTIVE')));
