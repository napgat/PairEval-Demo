# Full System Day 5 — Reports and Score Decisions

Date: 29 September 2026. Scope is the seven-day student prototype with synthetic data only. This is not production or real-user acceptance. All changes belong to the independent PairEval repository. The SQLite Demo database, root repository, Lab and submodules were not changed.

## PRD IDs and work

| Area | Implementation | PRD status |
|---|---|---|
| Day 4 carry-over | `Idempotency-Key` is required on Submit. A repeat of the same key returns the original revision; reusing it for another side/generation is rejected. The browser retains a key across a failed response and clears it after confirmed success or an answer change. | FR-API-02 in progress; synthetic development and staging integration passed. |
| Score decisions | Migrations 006–008 add score runs, criterion items, override records, appeals and the submission key. Instructor API can recompute Interim, override a group/individual component with a reason, Finalize after deadlines, and Reopen. Each run records config, source input, SHA-256 and output; a new run does not update the prior snapshot. My Score reads a Final snapshot when finalized and masks Individual/total below k=3. | FR-SCORE-06/08/09, DR-03/04 in progress; scheduled 02:00 run and DB-level snapshot update/delete protection remain. |
| Reports/export | Instructor report UI shows Group, Individual, Pair Coverage, quality flags and per-criterion q distribution. CSV uses UTF-8 BOM and formula-cell escaping. XLSX has exactly Group Summary, Individual Summary, Pair Coverage and Metadata sheets; Metadata includes formula version/config/hash/export time. Student/outsider export is denied. | FR-REPORT-01–06, FR-EXPORT-01/02/05/06 in progress; full QS-02–07, pair average/actions, raw pseudonymous/identity export and large async export remain. |
| Appeals/audit | Students can appeal within seven days of Finalize; other students cannot read that appeal. Owner/Co-teacher can resolve/reject with a response. Instructor audit viewer reads separate append-only storage and omits evaluator actor identity from its response. | FR-APPEAL-01/02, FR-AUDIT-01/02 in progress; trusted IP, full event coverage and independent integrity approval remain. |

The 188-ID execution matrix was regenerated. Every new relevant ID remains `in progress`, not Full System accepted. The PRD v2.1 source was not edited. No real identity export endpoint was opened; an identity export request returns 409.

## Commands and actual results

| Check | Result |
|---|---|
| `npm run db:migrate` with development and staging configs | Migrations `006_score_decisions`, `007_appeal`, `008_submission_idempotency` applied on both guarded PairEval operational Neon databases, each in a transaction. The first staging attempt for 006 timed out before a connection; the retry applied it successfully. No reset. |
| `npm test`; `npm run typecheck`; `npm run lint`; `npm run build` | 16 test files, **71/71** tests passed; typecheck, lint and production build passed. New unit tests open the XLSX and verify four sheet names, metadata and formula escaping. |
| `node scripts/day5-score-smoke.mjs development`; `node scripts/day5-score-smoke.mjs staging` | Both passed with disposable 3-group/9-student fixtures: Submit and same-key replay, cross-side conflict, snapshot 1/2/3, override without changing old snapshot, Finalize/Reopen, own Final score and k masking, appeal authorization/deadline, audit viewer denial for student, mobile report page, CSV BOM, four-sheet XLSX, student/outsider export denial. Fixture cleanup completed in both databases. |
| `node scripts/day2-audit-outcome-verify.mjs development`; `node scripts/day2-audit-outcome-verify.mjs staging` | Both passed correlation and restricted-role checks. Development: 84 COMMITTED, 0 REJECTED, 0 pending; staging: 52 COMMITTED, 1 historical REJECTED, 0 pending. Day 5 actions were 10/5/4/4/2/2 in development and 2/1/1/1/1/1 in staging for recompute/override/finalize/reopen/appeal-create/appeal-resolve. No Day 5 fixture users or synthetic classrooms remained. |
| [GitHub PairEval CI #25](https://github.com/napgat/PairEval-Demo/actions/runs/36582614147) and [Vercel staging](https://paireval-full-staging.vercel.app) | Code commit `ab63ee2` pushed to PairEval `staging` and work branch; CI #25 completed successfully. Dedicated Vercel Production deployment of `staging` showed Ready, followed by the successful staging smoke above. The SQLite Demo pages have not been claimed as Full System on Vercel. |

The first local smoke asserted a student by array position even though the API sorts UUIDs; it failed after an override and cleaned its fixture. The assertion was changed to find the student by ID and the rerun passed. Earlier test parallelism generated stale `.next` route types during `typecheck`; a build followed by a separate typecheck passed. A subsequent `pg` warning exposed concurrent queries on one My Score client; these queries now run sequentially.

## Gaps and next P0

**Day 5 is a partial pass.** The S7/S8 prototype path for snapshots, reports, export and appeals works on synthetic development and staging. Instructor evaluation/instructor weight, scheduled 02:00 recomputation, full quality signals, pair coverage actions/means, raw pseudonymous and Owner-confirmed identity export, async large export, data-subject export, retention/anonymize workflow, and DB-level snapshot immutability are incomplete. Student My Score uses current on-demand Interim computation outside Finalized state.

`npm audit --omit=dev --json` reported seven production-tree advisories after adding ExcelJS (1 critical, 3 high, 3 moderate), including a Next.js advisory and a transitive UUID advisory under ExcelJS. Staging remains synthetic; dependency upgrade and regression verification are required before any broader use. The audit writer still lacks trusted request IP. No real-user or production approval was requested for this course prototype.

Next P0: (1) finish instructor evaluation/weight and additional evaluator flow; (2) complete per-criterion quality/coverage and protected raw export; (3) add scheduled recomputation and synthetic data-subject/retention workflow, then rerun regression and role tests.
