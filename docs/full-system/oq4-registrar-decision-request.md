# OQ-4 — Registrar decision request (withdrawn students)

Date: 30 September 2026 (Asia/Bangkok)
Status: **Awaiting Registrar decision**. This document is a review package, not an approval or an implemented policy. Only synthetic records may be used meanwhile.

## Decision requested

Please confirm the authoritative source and effective time for a student's withdrawal, and approve or amend this proposed behavior:

1. The roster records `WITHDRAWN` and an effective UTC timestamp. Only an authorized Registrar feed or an Owner action backed by Registrar evidence may set it. Reimports must not silently reactivate a withdrawn student.
2. From the effective time, no new pair is assigned to that student, no pending pair from that student remains active, and the system regenerates eligible pending work without allowing self or same group evaluation. If feasible coverage falls, the instructor receives the numeric reason; if no eligible evaluator remains, publish/reassignment is blocked rather than writing a partial plan.
3. Current score recomputation excludes the withdrawn student's item and answers, while prior submitted revisions, pairs, audit events and snapshots remain intact for an authorized review. A Final snapshot is never edited in place; correction requires a reasoned Reopen and a new snapshot.
4. Students and instructors receive only role appropriate notices. A withdrawn student's access to current assignment and score requires an explicit Registrar decision; the proposed default is to deny new evaluation access while preserving a controlled records request path.

## Points requiring an explicit answer

| Question | Proposed default | Registrar answer |
|---|---|---|
| Source of truth and who may set `WITHDRAWN` | Registrar feed, or documented Owner action | Pending |
| Effective time when notice arrives late | Registrar effective timestamp; recalculate from that time | Pending |
| Existing submitted answers | Keep for history, exclude from new current score | Pending |
| Pending evaluator assignments | Reassign only when eligibility and workload rules allow | Pending |
| Previously Finalized score | Preserve old Final; Owner must Reopen with reason to correct | Pending |
| Withdrawal reversal / reinstatement | New explicit event and generation, no silent roster upsert | Pending |
| Student access and records request | Disable new evaluations; governed records request remains | Pending |
| Retention period and who can inspect old identity | Follow approved retention/access policy | Pending |

## Acceptance evidence after approval

- Synthetic tests for withdrawal before assignment, after assignment but before Submit, after Submit, and after Finalize; repeat with late and reversed notices.
- Verify no forbidden evaluator/item appears in current pairing, score, export or student API, while authorized history remains unchanged.
- Verify transaction rollback when reassignment is infeasible, plus audit request/outcome, notification recipient scope and concurrent roster edit behavior.
- Update PRD OQ-4 and data model in a separate reviewed version; update the traceability matrix and API contract; obtain Registrar signoff before real-user pilot.

Decision owner: Registrar / Academic affairs. **A named contact has not yet been identified by the project owner.** Product owner and Privacy Officer review downstream scoring, access and retention effects. Record approver, date, exact policy text and document version here when received; do not infer approval from the development choice.
