import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const trace = readFileSync(join(root, "docs/design document/12_Traceability Matrix.md"), "utf8");
const prd = readFileSync(join(root, "docs/design document/pairwise_evaluation_prd 1.md"), "utf8").split(/\r?\n/);
const rows = [...trace.matchAll(/^\| `([^`]+)` \| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\s*$/gm)];
if (rows.length !== 188 || new Set(rows.map((row) => row[1])).size !== 188) throw new Error(`Traceability ID count is ${rows.length}, expected 188 unique IDs`);

function classification(id) {
  if (/^OQ-/.test(id)) return ["Product / policy owner", "docs/design document/13_Decisions Needed.md"];
  if (/^FR-(AUTH|AUTHZ|API|SEC|PRIV|ANON|AUDIT)/.test(id)) return ["A — platform / security", "planned: src/lib/full-system/auth, access, audit"];
  if (/^FR-(CLASS|ASSIGN|REPORT|EXPORT|NOTIF|APPEAL|A11Y)/.test(id)) return ["C — UI / API", "planned: src/app/full-system and src/app/api"];
  if (/^FR-(PAIR|EVAL|SCORE|QS)/.test(id) || /^INV-/.test(id) || /^QS-/.test(id)) return ["B — domain rules", "planned: src/lib/full-system/domain"];
  if (/^DR-/.test(id)) return ["A — data", "planned: db/migrations and src/lib/full-system"];
  if (/^NFR-/.test(id)) return ["A — platform; D — verification", "planned: infrastructure and full-system tests"];
  if (/^AR-/.test(id) || /^[ACD]\d+$/.test(id)) return ["A — architecture", "planned: full-system architecture and data access"];
  throw new Error(`No owner/location for ${id}`);
}

function priority(id, line) {
  const match = line.match(/^\|\s*[^|]+\|\s*([MSC])\s*\|/);
  if (match) return match[1];
  if (/^OQ-/.test(id)) return "policy gate";
  return "unranked in PRD";
}

const migrationIds = new Set(["DR-04", "DR-05", "DR-09"]);
const day2Progress = new Map([
  ...["FR-AUTH-01", "FR-AUTH-02", "FR-AUTH-03", "FR-AUTH-04"].map(id => [id, ["src/lib/full-system-oidc.ts; src/lib/full-system-auth.ts; src/app/api/auth", "OIDC claim/PKCE unit tests passed; approved staging callback/per-session logout observed; synthetic staging provider-denial callback 403 and bad state 400; expired/revoked sessions 401; silent renewal and real Google denial pending"]]),
  ...["FR-AUTHZ-01", "FR-AUTHZ-02", "FR-AUTHZ-03", "FR-AUTHZ-04"].map(id => [id, ["src/lib/full-system-auth.ts; src/lib/full-system-classrooms.ts; src/app/api/full-system; src/app/api/admin", "staging synthetic admin/owner/co-teacher/TA/student/outsider roster and role checks passed; admin has no implicit classroom read; entitlement and final-owner checks passed; unimplemented resources remain"]]),
  ...["FR-CLASS-01", "FR-CLASS-02", "FR-CLASS-03", "FR-CLASS-04", "FR-CLASS-05", "FR-CLASS-06"].map(id => [id, ["src/lib/full-system-roster.ts; src/lib/full-system-classrooms.ts; src/lib/full-system-members.ts; src/app/api/full-system/classrooms", "CSV parser tests and synthetic development/staging create/import/rollback/version/final-owner API smoke passed; staging owner staff/entitlement smoke passed; UI acceptance pending"]]),
  ["FR-AUDIT-01", ["src/lib/full-system-audit.ts; src/lib/full-system-audit-outbox.ts; db/migrations/003_audit_outbox.sql; db/audit/001_audit.sql; scripts/audit-integrity.mjs", "separate audit DB/role and protected Vercel smoke passed; migration 003 on development/staging; staging correlated 5 COMMITTED and 1 REJECTED with zero pending; 19-row local checkpoint passed; required event coverage/independent integrity pending"]],
  ["FR-AUDIT-02", ["src/lib/full-system-audit.ts; db/audit/001_audit.sql", "audit schema has actor/action/resource/UTC timestamp and before/after/reason/IP fields; writer omits trusted IP and some event context; acceptance pending"]],
  ["FR-AUDIT-03", ["db/audit/001_audit.sql; scripts/audit-smoke.mjs", "app role INSERT/SELECT allowed and UPDATE/DELETE/TRUNCATE denied on both audit DBs; no audit mutation API; owner-level tamper protection pending"]],
]);
const day3Evidence = "62 local tests, typecheck/lint/build, synthetic development and staging assignment smoke; Day 3 prototype only; requirement-specific acceptance and remaining gates in day-03.md";
const day3Progress = new Map([
  ...["FR-ASSIGN-01", "FR-ASSIGN-02", "FR-ASSIGN-03", "FR-ASSIGN-06", "FR-ASSIGN-07", "FR-ASSIGN-08"].map(id => [id, ["src/lib/full-system-assignments.ts; src/app/full-system/classrooms/[id]/assignments/page.tsx; db/migrations/004_assignment_pairing.sql", day3Evidence]]),
  ...["FR-PAIR-01", "FR-PAIR-02", "FR-PAIR-03", "FR-PAIR-04", "FR-PAIR-05", "FR-PAIR-06", "FR-PAIR-07", "FR-PAIR-08", "FR-PAIR-09", "FR-PAIR-12", "FR-PAIR-13", "FR-PAIR-14", "INV-G1", "INV-I1", "INV-2", "INV-3", "INV-4", "INV-5", "INV-6"].map(id => [id, ["src/lib/full-system-pairing.ts; src/lib/full-system-pairing.test.ts; src/lib/full-system-assignments.ts; db/migrations/004_assignment_pairing.sql", day3Evidence]]),
  ...["DR-02", "DR-03"].map(id => [id, ["db/migrations/001_initial.sql; db/migrations/004_assignment_pairing.sql", "additive migration 004 applied to development and staging; synthetic assignment/pair persistence checked; full requirement acceptance pending"]]),
]);
const day4Progress = new Map([
  ...["FR-ASSIGN-04", "FR-ASSIGN-05"].map(id => [id, ["src/lib/full-system-assignments.ts; src/lib/full-system-timezone.ts; src/app/full-system/classrooms/[id]/assignments/page.tsx", "Day 4 synthetic development/staging deadline denial/extension and timezone unit tests; authenticated editor UI acceptance pending"]]),
  ...["FR-EVAL-01", "FR-EVAL-02", "FR-EVAL-03", "FR-EVAL-04", "FR-EVAL-05", "FR-EVAL-06", "FR-EVAL-07", "FR-EVAL-08", "FR-EVAL-09", "FR-EVAL-11", "FR-EVAL-12"].map(id => [id, ["db/migrations/005_evaluation.sql; src/lib/full-system-evaluation.ts; src/app/full-system/assignments/[id]/evaluate/[side]/page.tsx", "Day 4 synthetic development/staging scope, draft refresh/exclusion, partial submit, immutable re-submit and deadline smoke; browser UI acceptance pending"]]),
  ...["FR-SCORE-01", "FR-SCORE-02", "FR-SCORE-04", "FR-SCORE-05", "FR-SCORE-07", "FR-SCORE-10", "FR-SCORE-11", "FR-SCORE-12", "FR-SCORE-13"].map(id => [id, ["src/lib/full-system-scoring.ts; src/lib/full-system-my-score.ts; src/app/full-system/assignments/[id]/my-score/page.tsx", "PRD worked-example golden unit tests and Day 4 PostgreSQL latest-submission score-change smoke; full scoring acceptance pending"]]),
  ...["FR-ANON-01", "FR-ANON-02", "FR-ANON-03", "FR-ANON-04", "FR-API-01", "FR-API-06"].map(id => [id, ["src/lib/full-system-evaluation.ts; src/lib/full-system-my-score.ts; src/app/api/full-system/assignments", "Day 4 synthetic scope/no-identity and k-threshold unit/API evidence; draft API contract path and wider negative matrix pending"]]),
]);
const lines = [
  "# PRD v2.1 execution matrix — through Day 4",
  "",
  "Source: [PRD v2.1](../design%20document/pairwise_evaluation_prd%201.md) and [Traceability Matrix](../design%20document/12_Traceability%20Matrix.md). Exactly 188 IDs in PRD section 1–19. `M/S/C` comes from PRD MoSCoW tables; `unranked in PRD` is deliberate, not an inferred priority. Owner is the workstream assignment (A platform/data, B domain, C UI/API, D verification), not an institutional approver.",
  "",
  "`not started` means the Full System implementation has no qualifying evidence. `in progress` means partial implementation or setup exists; it does not mean PRD acceptance passed. Operational migrations 001–005 are on Neon development/staging. Separate audit development/staging projects and restricted roles passed permission smoke. Assignment/pairing and student evaluation/My Score have synthetic prototype evidence. Instructor evaluation, scheduled score recomputation, finalize, extra pairing and notifications remain. Independent audit integrity, full event coverage, retention and full backup/restore remain. No ID is marked implemented or tested. Working SQLite Demo behavior and its tests are baseline evidence only, never automatic PRD v2.1 passage. `planned:` paths are targets, not existing files. Decision references are from the traceability matrix; `—` means no explicit dependency recorded there.",
  "",
  "| PRD ID | PRD line | Owner | Priority | Status | Implementation location | Test evidence | Dependent decisions / gates |",
  "|---|---:|---|---|---|---|---|---|",
];

for (const row of rows) {
  const [, id, lineText, , , decisionText] = row;
  const lineNo = Number(lineText);
  if (!prd[lineNo - 1]?.includes(id)) throw new Error(`PRD line mismatch for ${id} at ${lineNo}`);
  const [owner, planned] = classification(id);
  const hasDdl = migrationIds.has(id);
  const progress = day4Progress.get(id) ?? day3Progress.get(id) ?? day2Progress.get(id);
  const location = progress?.[0] ?? (hasDdl ? (id === "DR-09" ? "db/audit/001_audit.sql; scripts/audit-smoke.mjs; scripts/audit-integrity.mjs" : "db/migrations/001_initial.sql; db/migrations/002_identity_roster.sql (partial)") : planned);
  const decision = decisionText.trim().replace(/\|/g, "\\|");
  const evidence = progress?.[1] ?? (!hasDdl ? "none for Full System" : id === "DR-09" ? "separate Neon audit dev/staging; restricted-role and Vercel staging probes passed; staging 5 committed/1 rejected correlated outcomes and 19-row local checkpoint passed; independent integrity/retention pending" : "migrations 001–005 applied to Neon development/staging; requirement-specific acceptance pending");
  lines.push(`| \`${id}\` | [${lineNo}](../design%20document/pairwise_evaluation_prd%201.md#L${lineNo}) | ${owner} | ${priority(id, prd[lineNo - 1])} | ${hasDdl || progress ? "in progress" : "not started"} | ${location} | ${evidence} | ${decision} |`);
}
lines.push("", "## Acceptance gate", "", "Full System acceptance remains pending until the authenticated staging flow, privacy notice, audit event coverage, cross-classroom security, and requirement-specific tests run. See day-01.md through day-04.md for actual commands and external blockers.", "");
writeFileSync(join(root, "docs/full-system/prd-v2.1-execution-matrix.md"), lines.join("\n"));
console.log(`Execution matrix written: ${rows.length} unique PRD IDs`);
