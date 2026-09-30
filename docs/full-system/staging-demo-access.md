# Staging demo access — 30 September 2026

Scope: two Google accounts supplied by the project owner for viewing the independent PairEval student-project staging site. The account addresses are held in the staging database and an ignored local fixture manifest; they are not committed to the repository. All classroom peers, work and scores remain synthetic. This is not institutional approval to process real course grades.

## Completed

- Enrolled one owner-provided Google account as `OWNER` with classroom-creation entitlement and one as `STUDENT` in the same **PairEval Student Project Preview** classroom. Both rows start `PENDING` until their own Google sign-in. Eleven other classmates use `@example.test` identities; the three groups contain four students each. No assignment, pair, evaluation or score was seeded.
- Added both addresses to the Google Auth Platform `PairEval` project's OAuth **Test users** list. The project remains `External` / `Testing`; the UI showed 2 test users after saving.
- Added a versioned **student-demo-staging-v1** acknowledgement screen and same-origin API for the staging prototype. It states that account identifiers, sessions and actions are stored, class content is synthetic, and automatic deletion/official policy approval are absent. The account holder must click acknowledgement after Google sign-in; no acceptance record was preinserted for either account. The prior **synthetic-staging-v1** test marker continues to work only for `@example.test` fixtures.
- Acknowledgement writes an audit intent and outcome. Origin and notice-version checks reject invalid requests.

## Verification

- Local: 102/102 existing tests, typecheck, lint and build passed. A synthetic development browser/API smoke observed classroom read `428` before acknowledgement, origin `403`, wrong version `422`, clicked the notice in the browser, then observed saved version and classroom read `200`; fixture cleanup completed.
- Staging: the same synthetic browser/API smoke passed after deployment. The Vercel deployment for `14dcad9` showed **Ready**, and the new route answered `405` to GET as expected for its POST-only implementation. The smoke test removed its synthetic user and session afterward.
- The project owner's browser selected each account in the Google Account Chooser. Both real Google callbacks returned to `/full-system` and displayed the staging notice with the correct account address; each was then logged out without acknowledgement. A read-only staging database check found both accounts `ACTIVE`: teacher `OWNER` with classroom creation enabled, student `STUDENT` with classroom creation disabled. Neither account has acknowledged the notice yet.

## Current boundary and next check

- The project owner can now select either Google account on the staging sign-in page. Each account holder must read and click the staging acknowledgement themselves before classroom data appears. The login callback and notice gate are verified; the account holders' subsequent acknowledgement and classroom screens have not been observed.
- The preview classroom intentionally has no assignment or scores; the teacher can create and publish a synthetic assignment, after which the student can see assigned work. Existing scoring cron and QS-05 collection exclude mixed real-email cohorts by design.
- The prototype acknowledgement is separate from the unapproved PRD Privacy Notice and OQ-6. It must not be presented as consent for real classroom use.
