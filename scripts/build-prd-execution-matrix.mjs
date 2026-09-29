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
  ...["FR-AUTH-01", "FR-AUTH-02", "FR-AUTH-03", "FR-AUTH-04"].map(id => [id, ["src/lib/full-system-oidc.ts; src/lib/full-system-auth.ts; src/app/api/auth", "OIDC claim/PKCE unit tests passed; approved staging callback/session and per-session logout observed; rejection/refresh pending"]]),
  ...["FR-AUTHZ-01", "FR-AUTHZ-02", "FR-AUTHZ-03", "FR-AUTHZ-04"].map(id => [id, ["src/lib/full-system-auth.ts; src/lib/full-system-classrooms.ts; src/app/api/full-system", "staging unauthenticated 401; development synthetic cross-classroom denial; staging synthetic owner/outsider/student read-scope and privacy-gate checks passed; full role matrix pending"]]),
  ...["FR-CLASS-01", "FR-CLASS-02", "FR-CLASS-03", "FR-CLASS-04", "FR-CLASS-05", "FR-CLASS-06"].map(id => [id, ["src/lib/full-system-roster.ts; src/lib/full-system-classrooms.ts; src/lib/full-system-members.ts; src/app/api/full-system/classrooms", "CSV parser unit tests and synthetic development/staging create/import/rollback/version/final-owner API smoke passed; UI, entitlement and full role tests pending"]]),
  ["FR-AUDIT-01", ["src/lib/full-system-audit.ts; db/audit/001_audit.sql; scripts/audit-integrity.mjs", "separate audit DB/role and Vercel protected smoke passed; 8-row development and 4-row staging request-intent checkpoints passed; required event outcomes/independent integrity pending"]],
  ["FR-AUDIT-02", ["src/lib/full-system-audit.ts; db/audit/001_audit.sql", "audit schema has actor/action/resource/UTC timestamp and before/after/reason/IP fields; writer omits trusted IP and some event context; acceptance pending"]],
  ["FR-AUDIT-03", ["db/audit/001_audit.sql; scripts/audit-smoke.mjs", "app role INSERT/SELECT allowed and UPDATE/DELETE/TRUNCATE denied on both audit DBs; no audit mutation API; owner-level tamper protection pending"]],
]);
const lines = [
  "# PRD v2.1 execution matrix — through Day 2",
  "",
  "Source: [PRD v2.1](../design%20document/pairwise_evaluation_prd%201.md) and [Traceability Matrix](../design%20document/12_Traceability%20Matrix.md). Exactly 188 IDs in PRD section 1–19. `M/S/C` comes from PRD MoSCoW tables; `unranked in PRD` is deliberate, not an inferred priority. Owner is the workstream assignment (A platform/data, B domain, C UI/API, D verification), not an institutional approver.",
  "",
  "`not started` means the Full System implementation has no qualifying evidence. `in progress` means partial implementation or setup exists; it does not mean PRD acceptance passed. Operational migrations 001/002 are on Neon development/staging. Separate audit development/staging projects and restricted roles passed permission smoke. A local checkpoint tool verified an eight-row development audit prefix and a synthetic one-row temporary-table restore; independent storage, event coverage, outcomes, retention and full backup/restore remain. No ID is marked implemented or tested. Working SQLite Demo behavior and its tests are baseline evidence only, never automatic PRD v2.1 passage. `planned:` paths are targets, not existing files. Decision references are from the traceability matrix; `—` means no explicit dependency recorded there.",
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
  const progress = day2Progress.get(id);
  const location = progress?.[0] ?? (hasDdl ? (id === "DR-09" ? "db/audit/001_audit.sql; scripts/audit-smoke.mjs; scripts/audit-integrity.mjs" : "db/migrations/001_initial.sql; db/migrations/002_identity_roster.sql (partial)") : planned);
  const decision = decisionText.trim().replace(/\|/g, "\\|");
  const evidence = progress?.[1] ?? (!hasDdl ? "none for Full System" : id === "DR-09" ? "separate Neon audit dev/staging; restricted-role and Vercel staging probes passed; eight-row development/four-row staging checkpoints and synthetic restore passed; independent integrity/retention pending" : "migrations 001/002 applied to Neon development/staging; requirement-specific acceptance pending");
  lines.push(`| \`${id}\` | [${lineNo}](../design%20document/pairwise_evaluation_prd%201.md#L${lineNo}) | ${owner} | ${priority(id, prd[lineNo - 1])} | ${hasDdl || progress ? "in progress" : "not started"} | ${location} | ${evidence} | ${decision} |`);
}
lines.push("", "## Acceptance gate", "", "Full System acceptance remains pending until the authenticated staging flow, privacy notice, audit event coverage, cross-classroom security, and requirement-specific tests run. See day-01.md and day-02.md for actual commands and external blockers.", "");
writeFileSync(join(root, "docs/full-system/prd-v2.1-execution-matrix.md"), lines.join("\n"));
console.log(`Execution matrix written: ${rows.length} unique PRD IDs`);
