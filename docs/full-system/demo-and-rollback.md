> บันทึกประวัติจากรอบก่อนแก้: โปรดใช้ [ผลล่าสุดตาม PRD v2.0](prd-v2.0-readiness-2026-10-15.md) สำหรับการนำเสนอครั้งนี้

# PairEval Full System prototype: start, demo, deploy and recover

This guide uses synthetic records only. The SQLite Demo at `/` is a reversible local baseline; `/full-system` is the PostgreSQL prototype. The dedicated staging URL is <https://paireval-full-staging.vercel.app/full-system>. It is not approved for real student data or production use.

## Local start

1. Use Node.js 24 and run `npm ci` in the independent `PairEval-Demo` repository. Keep the PairEval development `DATABASE_URL`, `AUDIT_DATABASE_URL`, OAuth client settings and session settings in ignored `.env.local`. The `PAIR_EVAL_ENV=development` and `PAIR_EVAL_EXPECTED_DB_HOST` guard must match the chosen Neon development host. Never copy values from Lab.
2. Run `npm run db:migrate` to apply additive PostgreSQL migrations. Run `npm run db:smoke` and `npm run audit:smoke` with the configured development database. Use `npm run build` followed by `npm run start -- -p 3101`.
3. Open `http://localhost:3101/full-system`. The Google client must allow the exact local callback `http://localhost:3000/api/auth/oidc/callback` if using port 3000. For port 3101, use a dedicated allowed localhost callback and matching `APP_ORIGIN`; never reuse Lab credentials. The fixture scripts use synthetic sessions and do not require a human Google account.

## Synthetic S1–S10 demonstration

| Route | What to show | Evidence boundary |
|---|---|---|
| S1 | Google sign-in, roster and Privacy Notice gate, logout | Only the approved staging test account has been observed manually; policy approval is pending. |
| S2 | Faculty classroom, CSV preview/import, staff roles | Disposable API fixtures validate atomic import, owner rule and outsider denial. |
| S3 | Draft assignment, criteria, artifact links, feasibility and Publish | Pair generation is persisted; impossible plan writes no partial pairs. |
| S4 | Assigned student's draft, partial Submit and Re-submit | Latest submitted revision drives scoring; draft alone does not. |
| S5 | Set instructor weight in DRAFT; after Publish choose pair, assign self and extra student; evaluate and regenerate | Weighted q and extra notification have synthetic API evidence. Group-change UI and complete S5 acceptance are pending. |
| S6 | Interim score and student's My Score | Check `NO_DATA`, participation, k threshold and no evaluator identity. |
| S7 | Group/Individual reports and protected CSV/XLSX | Four-sheet XLSX and formula escaping have fixture evidence; complete quality signals remain. |
| S8 | Override with reason, Finalize, Reopen and appeal | Snapshot history is retained; database-level immutability is pending. |
| S9 | Publish, regenerate, 48-hour and Finalize in-app notices | Reminder generation requires the guarded operator script; no deployed schedule or external delivery. |
| S10 | Outsider/student cross-role API denials, small-screen keyboard path | This is a bounded check, not a full NFR/security/accessibility acceptance. |

## Checks and staging deployment

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` sequentially. With a local server on port 3101, run guarded fixture scripts `node scripts/day3-assignment-smoke.mjs development`, `node scripts/day4-evaluation-smoke.mjs development`, `node scripts/day5-score-smoke.mjs development`, and `node scripts/day7-instructor-smoke.mjs development`. Each script checks its database host and deletes only its own synthetic fixture.

The [15 October 2026 hardening check](readiness-hardening-2026-10-15.md) records the dependency update and the current Thai UI selectors. It also lists the additional withdrawal/review, notice, quality, migration and audit checks. Run those scripts directly after changing the corresponding UI. Migration rehearsal discovers all checked-in migrations; it does not replace a backup/restore drill. Check production advisories with `npm audit --omit=dev --audit-level=high` before presenting or deploying a new build.

The private GitHub `staging` branch deploys to the dedicated Vercel project `paireval-full-staging`. Confirm the deployed commit and Ready status before running the same scripts with `staging`. Vercel Production environment variables belong to this staging project and must point to the separate PairEval staging operational and audit databases. A Ready deployment alone proves neither database connectivity nor feature acceptance.

## Recovery and rollback

1. Stop new writes by restricting access to the staging project. Record the deployed commit, database project/branch, migration version and audit outbox state. Do not reset the SQLite Demo database.
2. If an application release fails, redeploy the last verified PairEval staging commit through Vercel. Keep additive migrations in place; older code must be checked for compatibility before rollback.
3. For data recovery, create a Neon point-in-time branch of the **PairEval staging** database and verify synthetic record counts, latest submission revision, snapshots and audit correlation there. Restore into a separate test database first. Do not overwrite the current staging database until the affected records and recovery window are understood.
4. Drain the audit outbox with the guarded `npm run audit:drain`, then run `npm run audit:integrity` and the outcome verification script against the intended environment. Restricted audit app credentials must not have UPDATE/DELETE/TRUNCATE.
5. Re-run database, assignment, evaluation, score and instructor fixture checks, then confirm the staging URL. Record the recovery evidence and any lost interval. Monthly availability, production RPO/RTO and independent restore operations have not been established by this guide.

No step touches the root repository, its submodules or the Lab project.
