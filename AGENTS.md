# PairEval — instructions for coding agents

## Start here

1. Read `README.md`, `docs/PROJECT_STATUS.md`, `docs/GETTING_STARTED.md`, and `docs/TRY_IT.md`.
2. Use `docs/AI_HANDOFF.md` for a reproducible local setup and test task. Work only inside this standalone PairEval repository. Do not read or change sibling/root repositories, Lab repositories, submodules, their branches, or pointers.
3. The agreed target is a student prototype with synthetic local data. The active professor baseline is PRD v2.0 (132 IDs), mapped in `docs/full-system/prd-v2.0-evidence-map.md`. Historical v2.1/188-ID plans and v2.2 candidates are not the current acceptance checklist.

## Local runtime

- Verified setup: Windows x64, Node.js 24, an ASCII-only checkout path. Install with `npm ci`, build with `npm run build`, then run `Open-PairEval-Demo.cmd`. The PowerShell launcher supports `-NoOpen`.
- Start only one local demo checkout at a time. App: `http://localhost:3101/full-system`; role chooser: `http://localhost:3103`; embedded PostgreSQL: loopback port 55432. Do not kill unrelated processes to free these ports.
- The launcher generates `.env.local` and operational/audit databases. Do not request another person's credentials. Local synthetic role selection does not verify real Google OAuth or first-login privacy acceptance.
- `npm run demo:prepare-final` adds a separate synthetic assignment through real APIs. Wait its real five-minute deadline before Final. Re-running preserves prepared data; it is not a reset.
- Stop with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Stop-PairEval-Demo.ps1`. Preserve local data and prior revisions. Do not use legacy SQLite `seed:reset` to manage Full System.

## Changes and evidence

- Check Git status before editing; preserve unrelated work. Use scoped changes, no blind reset/clean/stash. Commit, push, deploy, delete branches, and change remote databases only when the human authorizes the relevant action.
- Never put env files, tokens, sessions, local state, databases, backups, keys, build output, or dependencies in Git or reports. `.verification` is private runtime state, including account/session information.
- Never apply this lineage's migrations to an existing v2.1/Neon database without reconciling its migration history; numbers 013–015 differ across historical branches.
- Use `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for code changes. Browser checks require `npx playwright install chromium`; `npm run test:demo-ui` checks the currently open synthetic demo without submitting assessments. Follow the manual workflow in `docs/TRY_IT.md` for mutation coverage.
- `npm run test:prd-v20` is an optional advanced acceptance suite that creates and cleans its own fixtures. It is not the first setup command. Read the script and its local-only guards before use.
- Fresh IDs, seeds, submissions, and scores can vary by installation. Do not assert the historical 16.94 score on a new fixture; use an independent calculation when verifying scoring and exports.
- Report actual results, skipped checks, environment, and limitations. A mapped requirement or a passing unit count does not prove complete PRD coverage. Do not invent readiness percentages from test counts.
- Keep `docs/PROJECT_STATUS.md` and current guides aligned with behavior. Historical logs describe their date, not current release approval. Do not expand this task into production certification.
