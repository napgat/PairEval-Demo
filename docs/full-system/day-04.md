# Full System Day 4 — Evaluation and Scoring

Date: 29 September 2026. This is a seven-day student project using disposable synthetic accounts and data. The results below are prototype evidence, not a real-user or production acceptance claim. The independent PairEval repo was used; the root repository, Lab, submodules and existing SQLite Demo database were not changed.

## Changes and PRD IDs

| Area | Work | Status and PRD trace |
|---|---|---|
| Day 3 carry-over | Assignment editor reads the classroom IANA timezone; local deadlines convert to UTC. Owner/Co-teacher can change OPEN/CLOSED deadlines; an expired side cannot save/submit until extended. | FR-ASSIGN-04/05 in progress. Instructor editor synthetic browser flow passed in both environments. |
| Evaluation | Migration 005 adds per-side, per-generation draft answers and immutable submitted revisions. Student APIs return only current-generation pairs assigned to the actor. UI shows item artifact links, six labeled choices, progress, autosave at 500 ms debounce, partial Submit/Re-submit and read-only deadline state. | FR-EVAL-01–09, 11/12; FR-API-01/06 in progress. Offline queue, instructor evaluation, and Idempotency-Key remain. |
| Scoring and anonymity | PRD §9 point mapping, quality weighted mean, band mapping, participation p/M, low confidence and NO_DATA; My Score reads only latest submitted revisions and returns only the caller's score. Individual value is hidden below three distinct submitted evaluators. | FR-SCORE-01/02/04/05/07/10–13 and FR-ANON-01–04 in progress. Daily scheduling, instructor weight/override, finalize snapshots and independent identity-view audit are not implemented. |

The execution matrix still has exactly 188 PRD IDs. New implementation evidence remains `in progress`, not Full System acceptance. The PRD v2.1 source was not modified. DQ-11 API paths and OQ-1/2 policy choices remain open.

## Actual verification

| Check | Result |
|---|---|
| `npm run db:migrate` with development and staging configs | `005_evaluation applied` on each PairEval operational Neon database using the expected-host guard and a transaction. No reset. |
| `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` | Final rerun: 15 files, **68/68** tests passed; typecheck, lint and production build passed. Unit tests include PRD worked example 12.798 group, 4.130 individual, p/M partial case, six forced choices, no-data/k threshold with three distinct raters, and classroom timezone/DST. |
| First development smoke | Exposed a deadline bug: an app clock comparison accepted Save after a database-relative past deadline. Changed the service to use PostgreSQL `clock_timestamp()`; the same test then passed. |
| `node scripts/day4-evaluation-smoke.mjs development` (API version) | Passed synthetic outsider/other-pair denials, draft refresh, exclusion of unsubmitted draft from score, partial submit, two immutable revisions, changed score from latest revision, deadline Save/Submit denial and post-expiry extension. Fixture cleanup ran. |
| GitHub and Vercel | PairEval `staging` commit `b811cec` (single snapshot connection for My Score) passed [CI #23](https://github.com/napgat/PairEval-Demo/actions/runs/36568253980) and its [Vercel deployment](https://vercel.com/npaha/paireval-full-staging/FDEShXJnGTe1eLqDsToqRBDaFQDv) showed Ready from `staging` at the [dedicated stable URL](https://paireval-full-staging.vercel.app). The final documentation-only commit still needs its own CI/deployment check. |
| `node scripts/day4-evaluation-smoke.mjs staging` (API version) | Passed the same synthetic API/score/deadline cases; the fixture was cleaned. |
| `node scripts/day2-audit-outcome-verify.mjs development` and `staging` | Final rerun: development 46 committed, 0 rejected, 0 pending; staging 42 committed, 1 historical rejected, 0 pending. Both showed `EVALUATION_SUBMIT_COMMITTED` (15 development, 9 staging) and `ASSIGNMENT_DEADLINE_CHANGE_COMMITTED` (4 each) in separate audit storage and 0 residual Day 4 users/classrooms. The first rerun hit local sandbox network `EACCES`; rerunning with network permission passed. |
| Synthetic browser editor and student flow, development/staging | Headless Chromium completed DRAFT creation, feasibility and publish through FS05–FS07, then the mobile student page FS08–FS09 changed a choice, observed autosave, refreshed to the saved choice and submitted revision 1 on both environments. The remaining API/score/deadline smoke passed and cleaned the fixture. The first browser test attempted to click an already-selected radio and waited for autosave; changing a value before asserting save corrected the test. |
| Final My Score browser rerun | The initial browser assertion matched a score rendered in two cards and failed strict locator mode; scoping to the first exact text fixed this test. Development encountered one 500 at a 16-second score request after revision 2, consistent with the 15-second pool connection timeout under slow Neon responses. Score read now uses one read-only repeatable-read connection. Final development and staging browser/API smoke both passed, including My Score UI, latest revision score change and unpublish invalidation. |

## Gaps and next P0

- **Day 4 is a partial pass.** Student evaluation and on-demand My Score passed synthetic development and staging browser/API tests. Instructor evaluations, persistent score snapshots, scheduled 02:00 recomputation, overrides/finalize, and the full k-anonymity negative matrix remain. My Score uses on-demand computation and an interim label.
- Draft autosave begins after 500 ms, but there is no offline queue and remote Neon latency can exceed two seconds. A refresh after the success indicator restores the draft; immediate navigation during an unsaved request remains a risk. Submit flushes pending answers first.
- The dedicated PairEval staging Privacy Notice is still a synthetic gate only. Production use, real students, policy sign-off, and institutional operations are outside this course prototype scope.
- Next P0: add instructor evaluation contract and submission idempotency; build persistent score snapshots with finalize/override and scheduled recomputation; complete accessibility and anonymity negative tests before claiming those PRD IDs pass.
