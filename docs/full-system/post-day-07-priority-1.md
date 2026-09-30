# Priority 1 follow-up — scheduled scoring and QS-05–07

Date: 30 September 2026 (Asia/Bangkok). Scope: the independent PairEval-Demo student prototype, development and staging, synthetic users only. PRD v2.1 remains the requirement baseline.

## Scheduled Interim scores (FR-SCORE-06)

- Migration `012_synthetic_quality_schedule.sql` adds a dedicated disabled service identity, one durable `(assignment, generation, classroom local date)` schedule key, and invocation outcomes. The existing instructor button still performs on-demand recomputation.
- A secret-guarded cron route calculates the next local 02:00 for each active synthetic classroom. It handles UTC date boundaries, timezone offsets, daylight-saving gaps and repeated hours. Missed days coalesce to the latest due day. A row lock, unique schedule key, immutable snapshot and audited mutation make retries safe. Finalized, draft, archived, unpublished and real-user classrooms are excluded. Every completed automatic score uses the same formula and snapshot path as instructor Interim scoring.
- Vercel config invokes the route daily at **19:00 UTC**, which is 02:00 the next day in Asia/Bangkok. Vercel cron schedules are UTC. This project uses a daily Hobby cron: [Vercel's documented limit](https://vercel.com/docs/cron-jobs/usage-and-pricing) allows one invocation per day and permits it anywhere within the scheduled hour. Thus this deployment cannot guarantee an exact 02:00 run, nor 02:00 for every possible classroom timezone. The application computes only after the correct local due instant and records the actual invocation time. Exact-time PRD acceptance remains open.
- The staging cron must be observed automatically in Vercel logs; an authorized manual Run proves the execution path and idempotency but does not prove scheduling.

## Verified evidence

- Unit tests for 02:00 Bangkok, Kathmandu, DST spring gap and fall repeat, missed runs and pre-publish rejection passed. Integrated tests, typecheck, lint and build passed before staging deployment.
- Migration 012 applied to Neon development and staging.
- Development synthetic API/DB smoke passed: wrong token returned 404; two concurrent authorized calls created exactly one Interim snapshot and schedule row; subsequent retry created zero new snapshots; matching immutable snapshot was attributed to the service identity; fixture cleanup completed.
- [GitHub CI #41](https://github.com/napgat/PairEval-Demo/actions/runs/36678269659) passed for `5f08983`, and [Vercel deployment](https://vercel.com/npaha/paireval-full-staging/7s2GkiG25swxUKnJAEnEnEgLAv69) displayed Ready for the same commit. The Cron Jobs page showed both daily jobs enabled, including `/api/full-system/cron/scores` at 19:00 UTC.
- With a separate synthetic due assignment on staging, Vercel Cron Jobs **manual Run** produced `GET 200` in the Vercel log at **13:34:01 Asia/Bangkok**. Database verification found one Interim snapshot attributed to the disabled service identity, one matching schedule key, and a completed job invocation created after the fixture. The staging fixture and ignored local fixture state were deleted after verification.
- Staging audit correlation check after cleanup passed: 203 committed, 3 historical rejected, **0 pending**. The score job added one `SCORE_RECOMPUTE_COMMITTED` outcome. The separate QS-05–07 staging browser/API smoke and cleanup also passed; details are in the linked quality log.
- A final read-only query found **0** `score-schedule-*`/`qs567-*` synthetic users, **0** matching classrooms, and **0** pending audit outcomes on staging.
- See [QS-05–07 method and browser evidence](post-day-07-quality-advanced.md) for the signal definitions, source restrictions and test boundary.

## Acceptance boundary

The prototype implementation path and manual staging execution are verified. The first actual **automatic** cron invocation has not yet been observed. This result does not assert precise automatic 02:00 execution or real-student data processing. Full System acceptance still depends on other PRD work and institutional decisions.
