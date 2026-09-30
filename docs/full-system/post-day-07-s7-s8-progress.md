# Post-Day-7 S7/S8 follow-up — local progress

Date: 30 September 2026 (Asia/Bangkok). Scope: independent PairEval-Demo student prototype with synthetic data. This is **not** a complete S7/S8 or Full System pass. The root repository, Lab, submodules and SQLite Demo were not changed.

## PRD IDs and changes

| ID | Change and evidence boundary |
|---|---|
| FR-REPORT-03 | Score snapshots now aggregate each logical pair/criterion across evaluator assignments: assigned, answered and weighted mean for canonical item A, respecting display side and instructor weight. The instructor report and CSV/XLSX Pair Coverage sheet show those values. Existing snapshots remain readable and keep their earlier coverage export schema. Local unit and synthetic development browser/API smoke passed; staging regression is pending. The “send extra evaluation” and “evaluate myself” actions remain on the assignment page, not the coverage row. |
| FR-EXPORT-03 | Added a raw comparison CSV route with generation-scoped HMAC evaluator aliases, UTF-8 BOM, spreadsheet formula escaping, instructor scope, audit intent/outcome, identity request denial, and a 10,000-answer synchronous limit. The button appears only when a server-side export key is configured. Local unit and synthetic development API smoke passed with a temporary test key, including outsider/student denial and identity request denial. A separate key is saved for the Vercel staging project but requires a new deployment; staging acceptance remains. |
| DQ-09 / FR-ASSIGN-03 / FR-PAIR-11 | Created a separately versioned [v2.2 candidate](../design%20document/pairwise_evaluation_prd%20v2.2%20candidate.md) with the generation-preserving unpublish wording. It remains a product owner review draft. PRD v2.1 and the 188-ID matrix still provide the approved line-reference baseline. |
| OQ-4 | Prepared the [Registrar decision request](oq4-registrar-decision-request.md) with effective-time, pending-pair, submitted-answer, Final snapshot, reinstatement and access questions. No Registrar answer or withdrawal implementation is claimed. |

## Checks and limitations

- `npm test`: 20 files, **82/82** passed, including new pair aggregation, old snapshot fallback, raw pseudonym and cron authorization tests.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed locally. `node scripts/build-prd-execution-matrix.mjs` regenerated all 188 IDs; FR-REPORT-03 and FR-EXPORT-03 remain **in progress**.
- A development score smoke test first failed because the sandbox denied PostgreSQL access. An escalated retry reached the database to create its fixture, but the sandboxed local server could not reach PostgreSQL, so the test got HTTP 500 instead of the expected 404. A later retry was interrupted; a bounded database check found no leftover fixtures. After launching the server with development DB access, the first extended smoke reached the raw CSV but its test incorrectly checked for BOM after `TextDecoder` had consumed it. The assertion was fixed to check the first byte, and the full development score/report/raw-export smoke then exited **0**. A final bounded query confirmed **0** `day5-%@example.test` users, **0** `day5-%` classrooms and **0** pending operational audit outcomes.
- `PAIR_EVAL_EXPORT_KEY` must be a distinct server-only value of at least 32 UTF-8 bytes before the raw export route can work. A new secret value was saved for the Vercel `paireval-full-staging` Production environment on 30 September; it takes effect only after a new deployment. It is not set in normal local runtime. Evaluator identity export remains denied pending role/policy review and an audited Owner confirmation flow.
- Added a token-guarded, advisory-locked and deduplicated 48-hour reminder route plus a Vercel daily cron declaration for 19:00 UTC (02:00 Bangkok). Authorization has a unit test. A synthetic development endpoint smoke passed: invalid token 404, valid token 200, due=0 and inserted=0. The full Day 3 synthetic development smoke then exercised the new route with due recipients: first call inserted the expected distinct evaluators, second call inserted 0, and the script exited 0 after fixture cleanup. A new `CRON_SECRET` was saved for the Vercel staging project Production environment on 30 September, but this revision has not yet been deployed, so **no scheduled invocation has been verified**. Daily score recomputation is still absent.
- Quality signals QS-02–07, database-level snapshot write protection, large asynchronous export, daily score recomputation, deployed notification scheduling, whole-route security/accessibility, and recovery checks remain open. No deployment, CI result, real-user test or production approval is claimed for this follow-up.

## Next P0

1. Configure dedicated pseudonym and cron keys in a synthetic environment, then run scoped raw-export/report/reminder browser/API smoke including negative roles, idempotency and old snapshots.
2. Complete quality signals and Owner-confirmed identity export with policy approval; add database snapshot safeguards without breaking synthetic fixture cleanup.
3. Install guarded scheduled jobs and run synthetic security, accessibility and restore checks before claiming the student prototype complete. Obtain Registrar and document-owner decisions separately before real-user use.
