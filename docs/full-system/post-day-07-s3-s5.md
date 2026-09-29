# Post-Day-7 S3/S5 pairing and group-change follow-up

Date: 30 September 2026 (Asia/Bangkok). This is a bounded follow-up to [Day 7](day-07.md), not a revision of its deadline or full-prototype result. All fixture records were synthetic and confined to the independent PairEval operational development/staging databases. The SQLite Demo database, root repository, Lab and submodules were not changed. PRD v2.1 source was not edited.

## Scope and PRD trace

| PRD ID / path | Result and boundary |
|---|---|
| FR-PAIR-04/05/06; S3 | The exact pairing plan shows feasible coverage, evaluator workload, assignment count and a numeric reduction reason. With three active populated groups sized 3/5/4 and target coverage 5, the maximum feasible balanced coverage is 3: each of the three group pairs receives 3 evaluations, 9 assignments total, with evaluator workload at most 8. A historical empty group is excluded. With two groups and no eligible group evaluator, actual coverage is 0 and publish is rejected without persisting a partial generation. More sizes, exclusions and concurrent-editor cases remain for full acceptance. |
| FR-ASSIGN-03, FR-PAIR-11; S5 | After generation 1 was published, a versioned CSV preview identified one move. Outsider, student and TA roster imports were denied; even the owner received 409 while the assignment was published. The owner used the 320 px browser path to unpublish, preview/import the move and republish. Generation 1 retained its 24 pairs and submitted comparison for history; generation 2 persisted 9 current pairs. The student's current My Score had zero answered comparisons and no old group component. All 12 active students received a regeneration notice. A finalized assignment cannot use this DRAFT-only path; withdrawal semantics are separate. |
| DR-02/03, FR-SCORE-03 | Pair/submission history was retained across generation change and excluded from current scoring. The instructor-weighted score snapshot agreed with My Score in the synthetic instructor fixture. Database-level immutability controls for score snapshots still need acceptance. |

The [188-ID execution matrix](prd-v2.1-execution-matrix.md) keeps these IDs **in progress**. Demo behavior and this bounded fixture do not pass a full PRD requirement automatically.

## Decisions and policy gates

The implementation follows the development choice in DQ-09: unpublish soft-invalidates the current generation, preserves pairs/submissions/snapshots, and republish creates a new generation with audit and notifications. This resolves the tested group-move path while the conflicting PRD wording awaits a versioned erratum. For FR-PAIR-05, coverage falls to the largest positive feasible value and reports `requested=5; actual=3; minEligible=3; workloadCap=8` in this fixture. DQ-10's zero-eligible two-group case blocks publish. OQ-4 remains open with Registrar: WITHDRAWN student status, pending-pair reassignment and current-score exclusion were **not** implemented or tested here. Policy approval is required before real-user use. The draft API contract still needs formal reconciliation.

## Commands and actual results

| Check | Actual result |
|---|---|
| `npm test` | 18 files, 76/76 tests passed, including the explicit 3/5/4 reduced-coverage case. |
| `npm run typecheck`, `npm run lint`, `npm run build` | Each exited 0 on the code commit. |
| `node scripts/day3-assignment-smoke.mjs development` and `staging` | Both exited 0. Owner/outsider/student/TA and published-state negative checks, CSV preview and 320 px import UI, coverage 5→3, generations 24+9, score isolation, notification counts, two-group infeasible rollback, clone and reminder retry passed. Each script removed its fixtures. |
| `node scripts/day7-instructor-smoke.mjs development` and `staging` | Both exited 0. Role denial, 320 px instructor UI, eligible extra evaluator, duplicate rejection, notice, instructor/student submission, weighted q and My Score/snapshot agreement passed. Each script removed its fixtures. |
| `node scripts/day2-audit-outcome-verify.mjs development` and `staging` | Both exited 0 with correlated intent/outcome events and 0 pending. Development: 207 committed, 0 rejected; staging: 143 committed, 1 historical rejected. Day 3/4/5/7 synthetic users and synthetic classrooms all 0 in each database. |
| [PairEval CI #33](https://github.com/napgat/PairEval-Demo/actions/runs/36613008778) | Commit `0716496` on `staging` completed successfully. |
| [Dedicated Vercel staging deployment](https://vercel.com/npaha/paireval-full-staging/CYEBoLcjjDZHKydTWV1RNR94YWYV) | Source `staging`/`0716496`, Production environment of the dedicated staging project, Ready. Stable URL: <https://paireval-full-staging.vercel.app/full-system>. The live staging smoke above exercised the deployed code and separate staging PostgreSQL database. |

The two initial development browser waits timed out at a 30-second UI response limit while the roster audit path was still working. The fixture cleanup ran, the wait was changed to observe the import HTTP response with a 120-second limit, and two subsequent full development runs passed. This is a test wait change, not a claim that audit latency meets a performance target. The PostgreSQL client emitted a future SSL-mode warning; all checks above exited 0.

## Status and next work

**Bounded S3/S5 path passed on synthetic development and staging data; Day 7's complete-student-prototype gate remains failed/partial.** No production, real-user UAT or full S1–S10 acceptance is claimed. The remaining technical and external gates are OQ-4/Registrar withdrawal policy, versioned DQ-09 erratum approval, complete feasibility/authorization/concurrency matrix, S7/S8 quality and protected export, deployed notification/score schedulers, database snapshot immutability, and whole-app security, accessibility and recovery evidence.

Next P0 package: (1) resolve OQ-4 and group-change edge policy with its owner, (2) finish S7/S8 report/quality/protected export and snapshot safeguards, and (3) install guarded schedulers and run the full acceptance matrix before a real-user pilot.
