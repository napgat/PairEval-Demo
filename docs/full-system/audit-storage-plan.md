# Separate audit storage plan (Day 1)

PRD v2.1 `DR-09` requires audit storage separate from the operational database. The two Neon projects created for development and staging hold **operational** data only. `db/audit/001_audit.sql` is a proposal and has not been applied to either project.

## Provisioning gate

1. Approve an independent audit account/project and retention, backup, integrity-check, and incident-access policies before real-user use. Use distinct development and staging audit databases or projects; never point both environments at the same audit store.
2. Apply `db/audit/001_audit.sql` using a database owner credential kept outside the app runtime. Create a separate application role and grant only `SELECT` and `INSERT` on `audit_event`; revoke table access from `PUBLIC`. The runtime role must not own the table or have `UPDATE`, `DELETE`, or `TRUNCATE`.
3. Put each environment's `AUDIT_DATABASE_URL` only in its ignored local environment file or Vercel Environment Variables. Do not reuse `DATABASE_URL` or the Lab project's credentials.
4. Implement an append-only writer and an independent integrity check (ordered event count and digest exported to a separately controlled store). Exercise denial of `UPDATE`/`DELETE`, cross-classroom read authorization, tamper detection, backup restore, and retention in staging with synthetic events.
5. Document the consistency policy for an operational transaction whose audit write fails before adding state-changing Full System routes. The provisional rule is to fail closed for critical actions and retry with an idempotency key; Product/IT must approve the final policy.

**Status:** plan and proposed DDL only. No audit database, role, integrity service, or policy approval exists yet. `DR-09` remains in progress, not passed.
