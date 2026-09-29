# Full System Day 7 — integrated prototype review

Date: 30 September 2026 (Asia/Bangkok). This review uses synthetic records only. Work is confined to the independent PairEval-Demo repository; the SQLite Demo database, root repository, Lab and submodules were not changed. This is a student prototype review, not real-user or production acceptance.

## PRD IDs and milestone

| PRD ID / path | Day 7 result |
|---|---|
| FR-PAIR-10, FR-API-07, FR-SCORE-03, FR-NOTIF-05; S5 | **In progress.** An editor can add unused eligible student evaluators to one current pair or assign that pair to self as instructor. Pair source and generation are persisted separately. The instructor uses the same draft/submit contract. `instructorWeight` is configured on a DRAFT assignment, and scoring uses the float as weighted-mean weight without duplicating comparison count. The extra student gets an in-app notice. Synthetic development/staging smoke passed, including outsider/student denial, duplicate instructor rejection, 320 px instructor UI, and `weight=0.5` yielding `q=2/3` across two comparisons. Changing a student's group through a complete unpublish/edit/publish UI path and full coverage acceptance remain untested. |
| S1–S4, S6–S9 | **Partial.** Prior day evidence and Day 7 regression prove specific synthetic routes below. None is fully accepted against all PRD criteria. |
| S10 and Day 7 complete-student-prototype gate | **Fail / incomplete.** Negative role checks and one 320 px path pass, but full IDOR/CSRF, measured accessibility/performance/restore and several must-have policy/service paths remain. |

The [188-ID execution matrix](prd-v2.1-execution-matrix.md) lists owner, PRD priority, implementation location, status, evidence and dependent decisions for every traceability ID. No ID is promoted to full acceptance solely from Demo behavior or these bounded fixtures. The PRD v2.1 source was not changed.

## Changes and evidence

- Commit `aaeae1f` adds the editor pair-evaluator API and instructor controls to the assignment page, role-scoped instructor evaluation, configurable assignment weight, weighted score inputs, tests, the matrix update and the [demo/recovery guide](demo-and-rollback.md). No new operational migration was needed: `assignment.instructor_weight` and pair `source` already existed in migrations 001 and 004.
- `scripts/day7-instructor-smoke.mjs` creates disposable app users, a classroom and assignment, adds an instructor and an extra student to one pair, submits opposite votes and reads the PostgreSQL score snapshot. It checks an in-app notice and 320 px instructor UI, then deletes its own records.
- `scripts/day7-migration-rehearsal.mjs` applies migrations 001–009 to a fresh isolated schema within a transaction, checks 24 tables, rolls back and verifies the schema is absent. This is a clean-schema migration rehearsal, **not** a production backup/restore drill.
- The audit outcome verifier now checks for residual Day 7 synthetic users/classrooms as well as earlier fixture prefixes.

## S1–S10 walkthrough status

| Path | Status and actual boundary |
|---|---|
| S1 | Partial: earlier staging test-account Google callback, Privacy Notice wait state and logout were observed. No Day 7 human login replay or approved Privacy Notice. |
| S2 | Partial: earlier synthetic classroom/roster/staff API smoke; complete screen-by-screen faculty walkthrough not repeated Day 7. |
| S3 | Partial: Day 7 development/staging assignment smoke passed feasibility, persisted pair counts 24 then 12 after regeneration, impossible-plan rollback and notifications. The PRD reduced-coverage policy differs from the current infeasible-plan behavior. |
| S4 | Partial: Day 7 development/staging evaluation smoke passed draft persistence, partial/re-submit, latest revision scoring, deadline and scope. Offline answer queue and full accessibility acceptance remain. |
| S5 | Partial: new development/staging instructor and extra-evaluator fixture passed, including weighted q and notification. Complete group-change and coverage workflow remains. |
| S6 | Partial: golden unit math and development/staging My Score/score snapshot regression passed. Daily scheduled recompute and every anonymity edge remain. |
| S7 | Partial: development/staging score smoke passed browser report, CSV BOM/formula protection and four-sheet XLSX. Full quality signals, pair coverage aggregation and protected identity export remain. |
| S8 | Partial: development/staging score smoke passed override, immutable application-level snapshot history, Finalize/Reopen and appeal. Database-level snapshot write prohibition and policy workflow remain. |
| S9 | Partial: development/staging assignment and score smokes passed publish/regenerate/48-hour/Finalize in-app events and retry. No deployed scheduler or email/push channel. |
| S10 | Fail as a complete path: outsider/student denials and 320 px controls passed, but whole-route authorization, screen-reader/contrast, load, availability and full restore targets were not measured. |

## Commands and actual results

| Check | Actual result |
|---|---|
| `npm test` | 18 files, **75/75** tests passed after Day 7 weight validation and weighted-mean tests. |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed. An earlier typecheck run in parallel with build temporarily failed on generated `.next/types/routes.js`; sequential typecheck passed after build. |
| `node scripts/day7-instructor-smoke.mjs development` and `staging` | Both exited 0. Role denial, eligible extra evaluator, duplicate denial, notification, instructor/student submission, `q=2/3`, comparison count 2 and no horizontal overflow at 320 px passed. Fixtures removed. |
| Day 3, Day 4 and Day 5 smoke scripts on development and staging | All six exited 0 on the Day 7 code/deployment. They cover assignment generation, evaluation/latest revision, score/report/export/appeal; see script output and earlier day logs for exact assertions. |
| `node scripts/day7-migration-rehearsal.mjs development` and `staging` | Both exited 0: migrations 001–009 applied to a fresh isolated schema, 24 tables observed; transaction rolled back and schema absent. Existing operational data and Demo SQLite were not reset. |
| `node scripts/day2-audit-outcome-verify.mjs development` and `staging` after all smokes | Both exited 0. Development: 160 COMMITTED, 0 REJECTED, 0 pending. Staging: 128 COMMITTED, 1 historical REJECTED, 0 pending. Day 3/4/5/7 synthetic users and classrooms all 0; audit intent/outcome correlation passed. |
| `npm audit --omit=dev --audit-level=high` | Exit 0; 0 high/critical advisories, 2 moderate advisories in ExcelJS/transitive uuid remain. |
| [PairEval CI #31](https://github.com/napgat/PairEval-Demo/actions/runs/36606536269) | `aaeae1f` on `staging` completed successfully. |
| [Vercel staging deployment](https://vercel.com/npaha/paireval-full-staging/AZqGjJhToUWiGpYcopNbbAzAUhnh) | Production environment of the **dedicated staging project**, source `staging`/`aaeae1f`, showed Ready. The live staging API/database smoke above passed; Ready alone is not feature proof. Stable URL: <https://paireval-full-staging.vercel.app/full-system>. |

## Decision, gates and work after Day 7

**Day 7 is a partial delivery and fails the plan's full student-prototype completion gate.** The new S5 instructor/extra-evaluator path works on synthetic development/staging records, but S1–S10 do not all meet their full criteria. No real student data, real-user UAT, production approval or M2–M4 acceptance is claimed.

Remaining external gates: approval of Privacy Notice and retention/data-subject policy, school OAuth/roster rules for real users, identity-export authorization, independent audit operations and production recovery objectives. These are tracked in `decisions.md`, the PRD errata proposal and the matrix; the PRD source remains unchanged. The existing draft API contract still needs formal reconciliation. Known technical gaps include group-change UX, reduced-coverage policy, full quality signals/pair averages, protected identity export, deployed notification and score schedulers, database snapshot immutability, complete route security matrix, full accessibility/performance/restore evidence and production RPO/RTO.

Next 1–3 P0 tasks after Day 7: (1) close reduced-coverage and group-change S3/S5 policy/UI with negative tests; (2) finish S7/S8 quality, coverage and protected export with approved policy and audit; (3) install guarded schedulers and run full S1–S10/security/a11y/recovery acceptance before any real-user pilot.
