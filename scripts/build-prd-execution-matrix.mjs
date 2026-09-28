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
const lines = [
  "# PRD v2.1 execution matrix — Day 1",
  "",
  "Source: [PRD v2.1](../design%20document/pairwise_evaluation_prd%201.md) and [Traceability Matrix](../design%20document/12_Traceability%20Matrix.md). Exactly 188 IDs in PRD section 1–19. `M/S/C` comes from PRD MoSCoW tables; `unranked in PRD` is deliberate, not an inferred priority. Owner is the Day 1 workstream assignment (A platform/data, B domain, C UI/API, D verification), not an institutional approver.",
  "",
  "`not started` means the Full System implementation has no qualifying evidence. `in progress` below means an initial DDL artifact exists, but has **not** been run on Neon. No ID is marked implemented or tested. Working SQLite Demo behavior and its tests are baseline evidence only, never automatic PRD v2.1 passage. `planned:` paths are targets, not existing files. Decision references are from the traceability matrix; `—` means no explicit dependency recorded there.",
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
  const location = hasDdl ? (id === "DR-09" ? "db/audit/001_audit.sql (proposal only)" : "db/migrations/001_initial.sql (partial)") : planned;
  const decision = decisionText.trim().replace(/\|/g, "\\|");
  lines.push(`| \`${id}\` | [${lineNo}](../design%20document/pairwise_evaluation_prd%201.md#L${lineNo}) | ${owner} | ${priority(id, prd[lineNo - 1])} | ${hasDdl ? "in progress" : "not started"} | ${location} | ${hasDdl ? "DDL review only; Neon migration/test pending" : "none for Full System"} | ${decision} |`);
}
lines.push("", "## Day 1 gate", "", "Full System test evidence remains absent until the staging database migration, authenticated deployment smoke, OAuth flow and requirement-specific tests run. The separate Day 1 log records the SQLite Demo regression results and external blockers.", "");
writeFileSync(join(root, "docs/full-system/prd-v2.1-execution-matrix.md"), lines.join("\n"));
console.log(`Execution matrix written: ${rows.length} unique PRD IDs`);
