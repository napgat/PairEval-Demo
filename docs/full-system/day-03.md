# Full System Day 3 — Assignment and Pairing

Date: 29 September 2026. Scope is a seven-day student project with synthetic development/staging demonstrations. This log records prototype evidence; it does not claim approval for real users or production operations. The independent PairEval repository was used throughout. The root KMITL repository, Lab repository, submodules, and existing SQLite Demo database were not modified.

## Changes and PRD traceability

| Area | Implementation | PRD IDs and limits |
|---|---|---|
| Assignment editor | DRAFT create/edit, two-side criteria, score/deadline, per-item HTTPS artifacts and overview link; clone copies configuration into DRAFT; editor UI at `/full-system/classrooms/{id}/assignments` | FR-ASSIGN-01–03, 06–08 in progress. FR-ASSIGN-04 deadline extension while OPEN and FR-ASSIGN-05 classroom-specific timezone display remain. UI currently uses Asia/Bangkok. |
| Feasibility and pairing | Deterministic seed, exact feasible coverage, evaluator eligibility, bounded balanced workload, numeric infeasibility reasons, saved left/right and pair rows at publish | FR-PAIR-01–09, 12–14; INV-G1, INV-I1, INV-2–6 in progress. Instructor extra assignments (FR-PAIR-10), affected-student notification after regrouping (FR-PAIR-11), and classroom size warning (FR-PAIR-15) remain. |
| History and persistence | Additive migration 004, assignment generations, canonical pair keys, artifact URL snapshots, unpublish invalidation with reason, re-publish preserving old rows | DR-02/03 and FR-ASSIGN-03 in progress. No score/submission migration yet. |

The 188-row `prd-v2.1-execution-matrix.md` was regenerated. All new evidence is marked **in progress**, not accepted. DQ-09/10/12/13/14 and OQ-4/8 remain dependent choices as recorded in that matrix. The PRD v2.1 source was not changed.

## Actual verification

| Command/check | Result |
|---|---|
| `npm run db:migrate` with development and staging configs | `004_assignment_pairing applied` on each PairEval operational Neon database. The migration is additive and ran in a transaction with the expected-host guard. |
| `npm test` | 13 test files, **62/62** tests passed, including a synthetic size sweep for eligibility, uniqueness, canonical pair order, exact coverage, and balanced load. |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed after correcting a TypeScript target incompatibility and React effect lint. Build includes six Assignment API routes and the new editor page. |
| `node scripts/day3-assignment-smoke.mjs development` | Passed through synthetic DRAFT/invalid weights, 3×4 feasibility, 24 persisted group assignments with item URLs and no Individual side, duplicate publish/edit denial, unpublish and generation 2 with 12 pairs, clone, and two-group infeasible publish rollback. Fixture cleanup ran. |
| GitHub CI and Vercel | Commit `65215f7` pushed only to PairEval `staging` and `codex/full-system-day-02`; [CI #18](https://github.com/napgat/PairEval-Demo/actions/runs/36562084956) passed. [Vercel deployment](https://vercel.com/npaha/paireval-full-staging/6aQFBFEtrUkzifL5bXoUL2jERvxo) showed Ready, Production environment from `staging`/`65215f7`. Stable URL: https://paireval-full-staging.vercel.app. |
| `node scripts/day3-assignment-smoke.mjs staging` | Passed through the same synthetic cases on stable staging URL and staging Neon. Fixture cleanup ran. |
| `node scripts/day2-audit-outcome-verify.mjs development` and `staging` | Development: 8 committed, 0 rejected, 0 pending; staging: 17 committed, 1 rejected, 0 pending. In **each** database the Day 3 action counts were 3 Assignment create, 2 draft replace, 2 publish, 1 unpublish committed; every delivered outcome matched a request intent in separate audit storage. Both showed 0 residual Day 3 users and 0 synthetic classrooms. Rejected count is from an earlier staging Day 2 test, not Day 3. |
| Staging editor URL | Unauthenticated GET of `/full-system/classrooms/00000000-0000-0000-0000-000000000000/assignments` returned HTTP 200 with the editor HTML. This is route availability, not an authenticated UI flow. |

## Gates and next work

- **Day 3 status: partial pass for the course prototype.** The assignment/pairing API, data path, synthetic staging test, CI and deployment passed. The full Day 3 PRD scope is not complete because the authenticated FS05–FS07 browser journey, OPEN deadline policy, classroom timezone display, instructor extra evaluations, and affected-student notifications remain unverified or unimplemented.
- Prototype limitations: the editor is available only to Owner/Co-teacher accounts that have passed the existing synthetic privacy gate. It has not had an authenticated browser UI journey with a disposable teacher account. The UI shows deadline time in Asia/Bangkok even though `classroom.timezone` exists. Current APIs do not extend an OPEN deadline, assign extra evaluators, or notify affected students. The existing Privacy Notice is still a policy gate for real users.
- Audit: publish/unpublish/create/edit/clone invoke the transactional outbox. The Day 3 synthetic outcomes correlated on development and staging with 0 pending. Clone is recorded as a new create action. Independent audit integrity and retention decisions remain from Day 2.
- Day 4 P0: implement student pair retrieval/evaluation flow and deadline transitions; finish OPEN deadline policy and classroom timezone display; test end-to-end UI with synthetic actor and correlate Assignment audit outcomes. Keep production acceptance separate from the course prototype.
