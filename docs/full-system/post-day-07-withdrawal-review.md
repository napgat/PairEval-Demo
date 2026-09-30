# Post-Day-7 synthetic withdrawal and instructor comparison review

Date: 30 September 2026 (Asia/Bangkok). Student prototype, synthetic data only. The original seven-day deadline was missed; this follow-up does not change that history. Full System, Day 7 and complete S7/S8 acceptance remain incomplete.

## Scope and policy boundary

OQ-4 follows the provisional development choice in [Decisions Needed](../design%20document/13_Decisions%20Needed.md): record WITHDRAWN and an effective timestamp, stop current assignments to that student, exclude withdrawn items/answers from current scores, preserve submitted history and require Reopen before correcting Final. Registrar approval remains pending and no contact has been identified. The [Registrar package](oq4-registrar-decision-request.md) remains the decision request for real records. PRD v2.1 stays the approved baseline; v2.2 is still an unapproved DQ-09 candidate.

## Implementation

- Owner-only `POST /api/full-system/classrooms/:id/members/:userId/withdraw` requires a reason, past/current effective timestamp and expected roster version. It is available only in development/staging and requires every student email in the classroom to use a reserved synthetic domain (`example.test` or `.invalid`). Co-teacher, TA, student and outsider have no withdrawal permission.
- Membership, roster version, reassigned pairs, notifications and a new Interim snapshot for each affected published job commit in one operational transaction. Any Finalized job requires Owner Reopen first. An infeasible reassignment rolls back the entire withdrawal; no partial classroom correction is accepted.
- The pairing flow preserves eligible existing peer comparisons and their display orientation, fills missing coverage with unused eligible evaluators and observes the existing coverage/workload/balance rules. Existing surplus comparisons remain; infeasible preservation blocks the operation. Numeric feasibility reasons are retained. Submitted pairs, revisions and earlier snapshots are never edited or deleted by the feature.
- Migration 010 adds a current-roster view. Current scoring, evaluation, My Score, reminders and active pair controls use it; historical pair counts still read the original table. A roster CSV cannot silently reactivate a withdrawn student. Draft withdrawal is honored by later publish/republish.
- `FR-QS-02`: Owner and Co-teacher can exclude a **submitted current-generation** comparison or restore it with a reason and an expected review ID. Migration 011 stores successive review decisions. The service appends a decision and computes a new Interim snapshot in one transaction. It rejects Finalized jobs until Reopen, stale decisions, foreign/unsent comparisons and unchanged decisions.
- Excluded answers no longer contribute to q, comparison counts, weighted means or k. They still count as submitted work for participation/M; the quality signals retain the submitted evidence for manual review. Quality CSV and XLSX Metadata include exclusion reasons, Pair Coverage reports excluded counts, and pseudonymous raw CSV retains the answer with `EXCLUDED` and its reason. No quality flag excludes or downweights an answer automatically.
- The review API projects compared item names and submitted choices without evaluator/reviewer identity. Reasons are instructor-entered text, so the UI asks instructors to avoid evaluator names. The UI paginates submitted comparisons in batches of 200. Old snapshots remain compatible with optional exclusion fields.
- An HTTP 202 audit-pending response is shown as pending in the two changed instructor pages. It is not displayed as confirmed success; operators must reconcile the durable audit outcome before retrying a mutation.

## Verification

Local unit tests **92/92** passed (21 files), plus typecheck, lint and production build. Added unit cases verify preserved pairing/display orientation, infeasible fixed plans, score/k exclusion with unchanged participation and advisory signals, immutable inputs/previous output, and retained raw answers with spreadsheet-safe exclusion reasons.

- `node scripts/post-day7-withdrawal-smoke.mjs development` exited 0. The synthetic owner browser excluded a submitted comparison and a Co-teacher restored it; both created atomic new snapshots, preserved Final/history and left participation unchanged. Student/TA/outsider, stale and Final-gate denials passed. Pseudonymous raw CSV retained the excluded answer and reason.
- The same development run passed submitted/pending/draft withdrawal, owner browser action, late timestamp, new current score/raw export exclusion, retained original answers/Final, withdrawn My Score/evaluation/notification scope, Final/Reopen, numeric infeasibility rollback, CSV reinstatement denial, concurrent roster-version conflict and role/origin/auth denials. Deadline extension preceded unpublish and generation-2 publication contained no withdrawn evaluator/item.
- Read-only audit verification after cleanup: development committed=282, rejected=3, pending=0, all synthetic users/classrooms=0. Withdrawal outcomes include 6 committed and 2 rejected across attempts; review outcomes include 2 committed. Rejected infeasible withdrawals leave only audit evidence. The verifier batches evidence reads while retaining the request/outcome correlation checks.
- `node scripts/post-day7-withdrawal-smoke.mjs staging` exited 0 against `5a8240d04bc0813ac7f5aa33ad3190caef2c66dc`. It passed the same review/withdrawal/report/export/history and negative checks, plus null-body/negative-version validation and a mocked HTTP 202 browser response displayed as pending before the actual exclusion. This mock checks UI semantics; it does not simulate an audit database outage. Screenshots captured the successful synthetic owner review and withdrawal before cleanup.
- Read-only audit verification after staging cleanup: committed=198, rejected=3 (including historical rejection), pending=0, all synthetic users/classrooms=0. New review outcomes=2 committed; withdrawal outcomes=4 committed/1 rejected. Development was rechecked at 282/3/0 with zero fixtures.
- Additive migrations 010/011 are applied to both development and staging. [CI #39](https://github.com/napgat/PairEval-Demo/actions/runs/36672007395) passed for `5a8240d`. The [Vercel deployment](https://vercel.com/npaha/paireval-full-staging/AnDqgau5ZBBEapkoJ4eSZ9maHqXf) showed Ready, Current and source staging/5a8240d, serving the stable staging domain. The evidence-only follow-up commit changes documentation and the matrix generator; application code remains 5a8240d.

The development smoke first exposed an invalid test sequence: a Reopened job is CLOSED, so the test now extends deadlines through the API before unpublish. A separate run received HTTP 202 after a committed override; one durable audit outcome was subsequently delivered by the operator drain. These failed attempts are not counted as a successful integration pass.

## Quality gaps kept explicit

| ID | Current state | Definition/evidence needed |
|---|---|---|
| QS-05 / OQ-6 | Not implemented; time collection disabled | An approved event definition, idle/background handling, aggregation and retention. Submit/draft timestamps do not measure comparison duration. Synthetic duration fixtures may be used later without enabling real telemetry. |
| QS-06 | Not implemented | PRD says close-friend favoritism with z > 2, but contains no close-friend source, reference population, group conditioning, minimum sample or zero-variance rule. No friendships or z scores are inferred from group membership. |
| QS-07 | Not implemented | Define how sparse forced-choice comparisons become a common item-by-rater rank matrix, handle ties/incomplete panels and choose the reporting scope. Standard Kendall W requires a defined rating/ranking panel; the prototype does not silently substitute a different agreement metric or fill missing votes. |
| FR-QS-03 | Not implemented | A criterion identity across assignments, definition of repeated low agreement and feedback policy after QS-07 is defined. |

Statistical reference for the QS-07 design decision: the maintainer's [DescTools KendallW documentation](https://andrisignorell.github.io/DescTools/reference/KendallW.html) specifies a subjects-by-raters matrix and tie correction. It also distinguishes an incomplete-data extension with different assumptions; choosing that model is still a product/statistical decision.

## Limits and remaining work

- Future scheduled withdrawals, reinstatement/reversed notices and a Registrar feed are absent. A late timestamp is recorded, while only a new current snapshot is recomputed; this does not reconstruct past effective-time score views.
- A CLOSED job can receive corrected pairs/snapshot, but students need a deadline extension before answering reassigned work. The feature does not extend a deadline automatically.
- Existing fixed loads may make a classroom withdrawal infeasible; this conservatively blocks the operation instead of replacing submitted work. Broader roster sizes, multiple simultaneous assignments and withdrawal-versus-submit/Finalize/roster races still need acceptance tests. The smoke covers concurrent withdrawal version conflict only.
- Review decisions and score snapshots are preserved by the application. Database-level UPDATE/DELETE prohibition on operational history is not established by these migrations.
- DSAR/retention, approved identity export, large asynchronous exports, scheduled score recomputation, observed automatic reminder firing and complete security/accessibility/backup/restore remain open. No real-user readiness or complete Quality pass is claimed.
