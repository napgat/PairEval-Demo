# Full System Day 6 — notifications, security and usability

Date: 29 September 2026. This is a synthetic-data student prototype, not production acceptance. Work is confined to the independent PairEval-Demo repository. The existing SQLite Demo database, root repository, Lab and submodules were not changed.

## PRD IDs and milestone status

| Area | Status and evidence |
|---|---|
| FR-NOTIF-01/02/03/04/06, S9 | In progress. Additive migration 009 creates private in-app notifications. Publish, re-publish after invalidation, and Finalize enqueue messages transactionally. A guarded operator script creates 48-hour reminders for assigned sides with incomplete latest submissions; a unique key makes retries idempotent. No-submission and retry cases were exercised; the partial-submission reminder case still needs a dedicated fixture test. Student GET/mark-read scope and deep links were tested. No deployed schedule, email or push transport exists. FR-NOTIF-05 extra-evaluator notification is not implemented because extra assignment is not implemented. A Finalize message is hidden after Reopen. |
| FR-EVAL-10; FR-A11Y-01/02/04/05/06 | In progress. The evaluation page shows a countdown below 48 hours, explicit pair/criterion legend, 24 px native radios, visible focus and polite save status. Headless Chromium at 320 px checked keyboard arrows, radio size and horizontal overflow in development and staging. Screen-reader, measured contrast, all-page keyboard and countdown boundary acceptance remain. |
| FR-SEC-02/07, S10 | In progress. Another student's notification cannot be marked read (404), outsider and instructor do not get student notifications, and cross-origin mutation is denied (403). CI now fails on high/critical production dependency advisories. Secret scanning, complete IDOR/CSRF route matrix, HSTS/cookie/browser verification, structured request logs and broader security review remain. |
| Day 4/5 carry-over | Instructor evaluation and instructor weight, extra evaluator assignment, full quality signals, raw protected export, scheduled score recomputation, retention/data-subject workflow and database-level snapshot write protection remain incomplete. S5 and full S7/S8/S10 are not accepted. |

The [execution matrix](prd-v2.1-execution-matrix.md) still contains exactly 188 IDs. Relevant new work is `in progress`, not automatically `tested` as a full PRD requirement. The PRD v2.1 source was not edited.

## Changed implementation

- `db/migrations/009_notification.sql`; `src/lib/full-system-notifications.ts`; `src/app/api/full-system/notifications/route.ts`; in-app list on `/full-system`. Messages use fixed Thai text and contain neither score nor user identity. Read queries require the recipient's active student membership, matching hosted domain, current generation and active assignment state.
- Publish/republish and Finalize enqueue within their existing audited operational transaction. Republish targets evaluators affected in either generation. The old generation's notifications stop appearing. The 48-hour script has an environment/host guard, optional assignment filter, current-generation pair/submission checks, and a database uniqueness key for retry.
- Updated evaluation controls and browser smoke at 320 px. Next.js and eslint-config-next moved from 16.2.10 to 16.3.7; the production audit gate was added to PairEval CI.

## Commands and actual results

| Check | Actual result |
|---|---|
| `npm run db:migrate` with guarded development and staging configs | `009_notification` applied transactionally to each PairEval Neon operational database; no reset. |
| `npm test`; `npm run typecheck`; `npm run lint`; `npm run build` | 17 files, **72/72** unit tests passed; typecheck, lint and Next 16.3.7 production build passed. |
| `node scripts/day3-assignment-smoke.mjs development` and `staging` | Both passed: feasible publish, invalidation/re-publish history, expected notification recipients, 48-hour reminder first run and retry with zero duplicate inserts, infeasible rollback. Disposable fixtures were removed. |
| `node scripts/day5-score-smoke.mjs development` and `staging` | Both passed after the initial deployment: Finalize notification/deep link, own/other-student/outsider scope, cross-origin denial, score snapshot/export/appeal regression. Subsequent development and staging reruns passed the new assertion that Reopen hides Finalize notification. |
| `node scripts/day4-evaluation-smoke.mjs development` and `staging` | Both passed evaluation and My Score regression; Chromium at 320 px verified radio arrows, 24 px control and no horizontal overflow. This is not a screen-reader or contrast audit. |
| `node scripts/day2-audit-outcome-verify.mjs development` and `staging` | Both passed restricted-role/correlation checks after final smoke: development 126 COMMITTED/0 REJECTED/0 pending; staging 94 COMMITTED/1 historical REJECTED/0 pending. Synthetic day3/day4/day5 users and classrooms: 0. Notification insertion is operational data and is not itself a new separate-audit action. |
| `npm audit --omit=dev --audit-level=high`; [PairEval CI #29](https://github.com/napgat/PairEval-Demo/actions/runs/36596659051) | CI completed successfully, including the new audit gate. After compatible fixes: **0 critical/high** production-tree advisories, **2 moderate** remain (`exceljs`/transitive `uuid`). The proposed forced downgrade of ExcelJS was not applied. |
| Ten sequential staging GETs per route | `/api/health`: HTTP 200, median 295 ms, p90 328 ms, max 1225 ms. `/full-system`: HTTP 200, median 51 ms, p90 84 ms, max 557 ms. These are one network run without authenticated load and do not establish NFR-PERF, availability or scale targets. |
| `git ls-files` check for env/database/secret-looking filenames | Only `.env.example` was tracked among matches; no local `.env`, SQLite or DB file was tracked. This is a filename check, not complete secret scanning. |

The first local score smoke returned HTTP 500 because a sandboxed local server could not open outbound Neon connections (`EACCES`). Starting the same local server with approved network access and rerunning passed. The failed fixture was cleaned by its `finally` path. SSL-mode compatibility warnings from `pg` remain; no credential was printed.

## Day 6 decision and remaining P0

**Partial pass.** In-app S9 paths for publish, re-publish, 48-hour reminder and Finalize have synthetic development/staging evidence. Notification scheduling is an operator-run script and is not installed as a Vercel cron; extra-evaluator trigger and external delivery are absent. S5 and full S7–S10 remain open. The app has no production or real-user approval. No real data, real recipient delivery or Lab service was used.

Next P0 for Day 7: (1) complete instructor evaluation/weight and additional evaluator assignment or mark S5 explicitly failed; (2) close score/report/privacy gaps that affect S7/S8 and exercise S1–S10 end to end on a clean fixture; (3) complete a bounded security/a11y/recovery check, update every matrix ID and deliver the student demo/rollback guide with remaining failures explicit. Policy approvals for real identities, privacy notice, retention and independent audit operations remain external gates.

## Closing result

Code commits `0e0ce99` and `204c4db` were pushed to PairEval `staging` and the work branch. The dedicated Vercel Production deployment of `204c4db` from `staging` showed **Ready**. The post-fix staging score smoke and assignment/reminder smoke each exited 0; final staging audit verification exited 0 with zero pending outcomes and no residual synthetic fixture users/classrooms. [CI #29](https://github.com/napgat/PairEval-Demo/actions/runs/36596659051) completed successfully. Day 6 remains a **partial pass** because the remaining P0 and unverified NFR/PRD gates above are substantive.
