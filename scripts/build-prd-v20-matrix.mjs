import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const commit = "f0b8b3cd7ad58a6c6401eeb4f0954b2271fa31b0",
  sha = "4d4d2e7fac0bfa30c3f16f313aee0adc58d30bd3f634acfdeb38da368b51567a";
let source;
try {
  source = await readFile(
    ".verification/prd-alignment-20261015/upstream-prd.md",
  );
} catch {
  const response = await fetch(
    `https://raw.githubusercontent.com/CE-SDPX/SDPX-AI/${commit}/project-ideas/pairwise_evaluation_prd.md`,
  );
  if (!response.ok) throw Error("Cannot retrieve the pinned professor PRD");
  source = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(source).digest("hex") !== sha)
  throw Error("PRD baseline hash mismatch");
const rows = [];
for (const line of source.toString("utf8").split("\n")) {
  const match =
    line.match(/^\|\s*((?:FR|NFR)-[A-Z0-9]+-\d+)\s*\|\s*([^|]+)\|/) ??
    line.match(/^- \*\*((?:FR|NFR)-[A-Z0-9]+-\d+) \((M|S)\)\*\*/);
  if (match && !rows.some((r) => r.id === match[1]))
    rows.push({ id: match[1], priority: match[2].trim() });
}
const families = {
  AUTH: "src/lib/full-system-oidc.test.ts; scripts/prd-v20-acceptance.mjs",
  AUTHZ:
    "scripts/day3-assignment-smoke.mjs; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  CLASS:
    "src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  ASSIGN:
    "scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts",
  PAIR: "src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs",
  EVAL: "scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  SCORE:
    "src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  REPORT: "scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs",
  EXPORT:
    "src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  NOTIF:
    "src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  APPEAL: "scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  AUDIT:
    "scripts/audit-smoke.mjs; scripts/day2-audit-outcome-verify.mjs; scripts/prd-v20-acceptance.mjs",
  QS: "src/lib/full-system-quality.test.ts; src/lib/full-system-quality-advanced.test.ts; src/lib/full-system-quality-feedback.test.ts; scripts/post-day7-quality-smoke.mjs",
  API: "scripts/prd-v20-acceptance.mjs",
  PERF: "scripts/prd-v20-performance.mjs",
  AVAIL: "scripts/database-restore-drill.mjs",
  SCALE: "scripts/prd-v20-performance.mjs",
  COMPAT: "scripts/prd-v20-acceptance.mjs; scripts/day7-instructor-smoke.mjs",
  OBS: "src/lib/observe-route.ts; src/proxy.ts; local structured logs",
  MAINT: "src/lib/full-system-scoring.test.ts; src/lib/prd-v20.test.ts",
  I18N: "src/lib/full-system-timezone.test.ts; scripts/day5-score-smoke.mjs",
  PRIV: "scripts/prd-v20-acceptance.mjs; scripts/database-restore-drill.mjs",
  ANON: "src/lib/full-system-scoring.test.ts; scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs",
  SEC: "scripts/prd-v20-acceptance.mjs; source/security configuration review",
  A11Y: "scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only)",
};
const gaps = {
  "FR-AUTH-01":
    "PARTIAL — live Google consent/callback needs the deployment OAuth credentials",
  "FR-CLASS-07": "LOCAL — archive/read-only/restore API acceptance",
  "FR-REPORT-04":
    "PARTIAL — QS-06 has synthetic declared friendship evidence; real-course source is undecided",
  "FR-API-05":
    "DEFERRED SHOULD — bounded synchronous exports, no mail delivery service",
  "FR-PRIV-02":
    "PARTIAL — inactive-account anonymization works; per-year identity separation for continuing users remains",
  "FR-SEC-01":
    "EXTERNAL — HTTPS/HSTS/cookie code exists; localhost HTTP exception and no deployed TLS verification",
  "FR-SEC-06":
    "EXTERNAL — ignored local configuration; production secret-manager setup is not available",
  "FR-SEC-07":
    "PARTIAL SHOULD — production dependency audit in CI; no hosted secret-scanning observation",
  "NFR-PERF-01":
    "PARTIAL — 200 concurrent API reads measured; not 200 full browser page loads",
  "NFR-PERF-02":
    "PARTIAL — continuous usage passes, 200-request instantaneous burst misses 300 ms",
  "NFR-PERF-03":
    "PARTIAL — continuous usage passes, 200-request instantaneous burst misses 800 ms",
  "NFR-AVAIL-01":
    "EXTERNAL — monthly and pre-deadline availability require time and monitored hosting",
  "NFR-AVAIL-02":
    "PARTIAL — encrypted full restore passes locally; independent off-device backups/continuous RPO remain",
  "NFR-SCALE-01":
    "PARTIAL — 200 students / 40 groups measured; 50 simultaneous populated classrooms not measured",
  "NFR-SCALE-02":
    "PARTIAL — bounded 200-request burst measured; 10x deployed traffic not measured",
  "NFR-COMPAT-01":
    "PARTIAL — Chromium/Firefox/WebKit; two released versions and real mobile devices remain",
  "NFR-OBS-01":
    "LOCAL — JSON request log and requestId verified on API responses",
  "NFR-OBS-02":
    "PARTIAL — worker-local alert logs; five-minute fault injection and external alert routing remain",
  "FR-A11Y-03":
    "PARTIAL — evaluation contrast and axe pass; full application/manual AA audit remains",
  "FR-A11Y-05":
    "PARTIAL — evaluation keyboard test; all flows manual audit remains",
  "FR-A11Y-07": "EXTERNAL SHOULD — manual NVDA/VoiceOver session not performed",
};
const md = [
  "# PRD v2.0 — evidence map",
  "",
  `Professor source commit: \`${commit}\` · SHA-256: \`${sha}\``,
  "",
  "This map uses the professor’s v2.0 IDs. A mapped test is evidence for its asserted cases, not a declaration that the complete requirement passed. No percentage is inferred from test counts. Latest executed results and outstanding release gates are in `prd-v2.0-readiness-2026-10-15.md`.",
  "",
  "| ID | Priority/category | Evidence to inspect | Scope/status |",
  "|---|---|---|---|",
];
for (const r of rows) {
  const family = r.id.split("-")[1];
  md.push(
    `| ${r.id} | ${r.priority} | ${families[family] ?? "Needs review"} | ${gaps[r.id] ?? "Mapped local evidence — inspect acceptance coverage"} |`,
  );
}
md.push(
  "",
  "INV-1 through INV-5: `src/lib/prd-v20.test.ts`, fast-check seed 20261015, 100 generated cohorts.",
  "",
  "Unresolved PRD decisions: two-group evaluator feasibility; retaining generations instead of deleting submitted pairs; academic-year calendar and real-course friendship evidence.",
  "",
);
await mkdir("docs/full-system", { recursive: true });
await writeFile("docs/full-system/prd-v2.0-evidence-map.md", md.join("\n"));
await writeFile(
  "docs/full-system/prd-v2.0-baseline.json",
  JSON.stringify(
    {
      version: "2.0",
      commit,
      sha256: sha,
      requirements: rows.map((r) => r.id),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Pinned v2.0 evidence map: ${rows.length} unique requirements, all mapped; explicit partial/external items retained`,
);
