# Day 2 — PostgreSQL identity, classroom, authorization and audit work

Date: 29 September 2026. Scope: PairEval-Demo independent repository only. SQLite Demo baseline remains intact; no root repository, Lab repository or submodule was modified. All new test identities and audit probes are synthetic.

## Implemented locally

| Area / PRD IDs | Change | Verification limit |
|---|---|---|
| `DR-04/05`, `FR-AUTH-01–04` | Applied `002_identity_roster.sql` to separate operational Neon development and staging databases. Added Google authorization-code/PKCE start/callback, JWKS ID-token verification, state/nonce/issuer/audience/expiry/email verification, exact email linking, classroom domain check, hashed 12-hour server sessions and logout. | OIDC claim unit tests passed. Dedicated staging Google client/secret and local client secret are not confirmed, so no live callback/login/logout test. Silent session refresh is not implemented. |
| `FR-AUTHZ-01–04`, `FR-CLASS-01–06` | Added server-side session, role, classroom and hosted-domain checks; classroom create/list, CSV parser, atomic roster import/upsert preview with version/digest check, staff add/remove with final-owner guard, FACULTY entitlement routes for SYSTEM_ADMIN, and a `/full-system` staging entry page. Changes use PostgreSQL only. | Parser/unit/typecheck/build passed. Cross-classroom direct API, import rollback and staging UI tests have not run. Privacy acceptance is gated until notice content is approved; the entry page does not claim a working FS-00–FS-04/FS-19 flow. |
| `DR-09`, `FR-AUDIT-01` | Created separate Neon audit projects, applied `audit_event` schema, activated non-owner `paireval_audit_app` roles with only `SELECT/INSERT`, and added an audit intent writer that blocks operational mutations when audit is unavailable or overprivileged. | Real permission smoke passed on both audit databases. Required event coverage, independent integrity, retention, backup/restore, and outcome reconciliation remain incomplete. |

The new Full System endpoints are under `/api/full-system/classrooms/...` so they cannot be confused with the existing SQLite Demo `/api/classrooms/...`. This differs from the draft API contract's unprefixed classroom paths and `roster:import` multipart path. DQ-11 still needs review and contract tests before freezing the public API. The PRD v2.1 source was not edited.

## External evidence and commands

| Action | Actual result |
|---|---|
| `npm run db:migrate` using ignored `.env.local` | `002_identity_roster applied (development)`; transaction and operational host guard passed. |
| `PAIR_EVAL_CONFIG=.env.staging.local; npm run db:migrate` | `002_identity_roster applied (staging)`; separate operational Neon endpoint. |
| Neon audit project creation + SQL editor | `PairEval Full System Audit Development` project `aged-surf-42976367` and `PairEval Full System Audit Staging` project `lucky-shadow-22569401` created. `audit_event` table/index and `PUBLIC` table privilege revoke executed successfully on each. |
| Neon UI `paireval_audit_runtime` inspection | Staging UI role inherited `neon_superuser` and retained `UPDATE/DELETE` despite direct `REVOKE`. An attempted `REVOKE neon_superuser` failed with `42501` and was rolled back. This role is not used by the app. |
| SQL-created `paireval_audit_app`, `npm run audit:activate -- development`, `-- staging` | Role created without Neon superuser membership, then given a random local credential through owner connection. Both activation commands verified login and restricted table permissions. Runtime URLs stored only in ignored `.env.local` and `.env.staging.local`; owner URLs remain in ignored `.env.audit.*.local`. |
| First `npm run audit:smoke -- development` | Failed authentication. Host-only inspection found both owner config files pointed to the same Neon endpoint. Added a cross-environment host guard, removed ambiguous runtime URLs, corrected the two ignored owner configs, and reactivated both roles. No actual audit permission pass was claimed from the failed run. |
| `npm run audit:smoke -- development`, `-- staging` after correction | Both passed: `INSERT/SELECT` allowed; actual `UPDATE/DELETE/TRUNCATE` denied with PostgreSQL `42501`. Probe transaction rolled back, so no synthetic event remained. Audit hosts are distinct and differ from each operational host. |
| `npm test` | 10 files, 47/47 tests passed, including new CSV and OIDC claim tests. |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed locally. Build generated `/full-system`, auth, classroom and admin routes. |
| Local built server on port 3101, unauthenticated HTTP checks | `/full-system` 200; `/api/auth/session`, `/api/full-system/classrooms`, `/api/admin/faculty-entitlements` 401; OIDC start 503 because client secret is missing; classroom POST without `Origin` 403 and with matching `Origin` but no session 401. These are negative-path checks, not login or role acceptance. |
| SQLite Demo Main Flow | Not rerun against the existing `data/demo.sqlite`, because the script expects a fresh seed and writes to that database. Day 1's protected baseline and actual Main Flow result remain recorded in `day-01.md`; Day 2 code does not modify Demo routes or SQLite schema. CI runs its own synthetic reset fixture. |

`pg` emitted its existing warning that `sslmode=require` semantics will change in a future major version; current TLS connections succeeded. The audit role activation and smoke commands did not print connection strings or generated passwords.

## Gates and status

- **Day 2 overall: incomplete.** The staging branch and Vercel deployment still need the Day 2 code, CI, `AUDIT_DATABASE_URL` runtime value, and authenticated deployment checks. A local build is not staging evidence.
- Google OAuth: the exact callback is `/api/auth/oidc/callback`; local and staging redirect URIs are in `oauth-redirects.md`. Dedicated staging client ID/secret and local secret are not confirmed. No OAuth success is claimed.
- Privacy notice: PRD `FR-PRIV-01` requires data categories, viewers and retention. Policy owners have not approved the text or OQ-6. The new page and APIs deny classroom access until acceptance of an approved version is possible; no real user should be enrolled.
- Audit: separate storage and database permissions pass, but `DR-09`/`FR-AUDIT-01` are **in progress**. Current `*_REQUESTED` events are intents, not proof of a committed operational outcome. Retention, backup/restore, integrity, coverage of all required events, and the critical-action failure policy need approval and tests. The unused overprivileged Neon UI role should be removed after approval.
- DQ-11 API contract, OQ-1/2/4/7, E-01–E-07 and any real-user data/score policy remain gates. Do not count the SQLite Demo or a database smoke as PRD Full System acceptance.

## Next P0 tasks

1. Complete dedicated PairEval Staging Google OAuth client registration and Vercel/local secret placement without sharing credentials in chat; verify exact callback, domain rejection, session/logout and cross-classroom authorization on staging with approved test accounts.
2. Approve and implement a versioned Privacy Notice, then run FS-00–FS-04/FS-19 with synthetic users on staging, including CSV rollback, role change/final-owner, entitlement and direct API security tests.
3. Complete audit outcome/integrity/retention and backup policy, remove the unused privileged Neon UI role, deploy `AUDIT_DATABASE_URL` on staging, and verify fail-closed mutations plus immutable audit evidence end to end.
