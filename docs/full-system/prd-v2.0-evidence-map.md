# PRD v2.0 — evidence map

Professor source commit: `f0b8b3cd7ad58a6c6401eeb4f0954b2271fa31b0` · SHA-256: `4d4d2e7fac0bfa30c3f16f313aee0adc58d30bd3f634acfdeb38da368b51567a`

This map uses the professor’s v2.0 IDs. A mapped test is evidence for its asserted cases, not a declaration that the complete requirement passed. No percentage is inferred from test counts. Latest executed results and outstanding release gates are in `prd-v2.0-readiness-2026-10-15.md`.

| ID | Priority/category | Evidence to inspect | Scope/status |
|---|---|---|---|
| FR-AUTH-01 | M | src/lib/full-system-oidc.test.ts; scripts/prd-v20-acceptance.mjs | PARTIAL — live Google consent/callback needs the deployment OAuth credentials |
| FR-AUTH-02 | M | src/lib/full-system-oidc.test.ts; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUTH-03 | M | src/lib/full-system-oidc.test.ts; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUTH-04 | M | src/lib/full-system-oidc.test.ts; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUTHZ-01 | M | scripts/day3-assignment-smoke.mjs; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUTHZ-02 | M | scripts/day3-assignment-smoke.mjs; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUTHZ-03 | S | scripts/day3-assignment-smoke.mjs; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-01 | M | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-02 | M | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-03 | M | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-04 | M | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-05 | S | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-06 | M | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-CLASS-07 | S | src/lib/full-system-roster.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | LOCAL — archive/read-only/restore API acceptance |
| FR-ASSIGN-01 | M | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-ASSIGN-02 | M | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-ASSIGN-03 | M | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-ASSIGN-04 | M | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-ASSIGN-05 | M | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-ASSIGN-06 | S | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-ASSIGN-07 | M | scripts/day3-assignment-smoke.mjs; src/lib/full-system-timezone.test.ts | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-01 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-02 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-03 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-04 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-05 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-06 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-07 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-08 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-09 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-10 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-11 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-01 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-02 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-03 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-04 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-05 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-06 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-07 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-08 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-09 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-10 | S | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-11 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-12 | M | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EVAL-13 | S | scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-01 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-02 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-03 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-04 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-05 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-06 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-07 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-08 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-09 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-10 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-REPORT-01 | M | scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-REPORT-02 | M | scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-REPORT-03 | M | scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-REPORT-04 | M | scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs | PARTIAL — QS-06 has synthetic declared friendship evidence; real-course source is undecided |
| FR-REPORT-05 | S | scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-REPORT-06 | M | scripts/day5-score-smoke.mjs; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EXPORT-01 | M | src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EXPORT-02 | M | src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EXPORT-03 | M | src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EXPORT-04 | M | src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EXPORT-05 | M | src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-EXPORT-06 | S | src/lib/full-system-raw-export.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-NOTIF-01 | M | src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-NOTIF-02 | M | src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-NOTIF-03 | M | src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-NOTIF-04 | M | src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-NOTIF-05 | S | src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-NOTIF-06 | M | src/lib/full-system-notifications.test.ts; scripts/day3-assignment-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-APPEAL-01 | S | scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-APPEAL-02 | S | scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUDIT-01 | M | scripts/audit-smoke.mjs; scripts/day2-audit-outcome-verify.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUDIT-02 | M | scripts/audit-smoke.mjs; scripts/day2-audit-outcome-verify.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-AUDIT-03 | M | scripts/audit-smoke.mjs; scripts/day2-audit-outcome-verify.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-12 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-13 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-14 | M | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PAIR-15 | S | src/lib/full-system-pairing.test.ts; src/lib/prd-v20.test.ts; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-11 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-12 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SCORE-13 | M | src/lib/full-system-scoring.test.ts; src/lib/score-engine.test.ts; scripts/day5-score-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-QS-01 | M | src/lib/full-system-quality.test.ts; src/lib/full-system-quality-advanced.test.ts; src/lib/full-system-quality-feedback.test.ts; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-QS-02 | S | src/lib/full-system-quality.test.ts; src/lib/full-system-quality-advanced.test.ts; src/lib/full-system-quality-feedback.test.ts; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-QS-03 | M | src/lib/full-system-quality.test.ts; src/lib/full-system-quality-advanced.test.ts; src/lib/full-system-quality-feedback.test.ts; scripts/post-day7-quality-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-API-01 | M | scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-API-02 | M | scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-API-03 | M | scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-API-04 | M | scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-API-05 | S | scripts/prd-v20-acceptance.mjs | DEFERRED SHOULD — bounded synchronous exports, no mail delivery service |
| NFR-PERF-01 | Performance | scripts/prd-v20-performance.mjs | PARTIAL — 200 concurrent API reads measured; not 200 full browser page loads |
| NFR-PERF-02 | Performance | scripts/prd-v20-performance.mjs | PARTIAL — continuous usage passes, 200-request instantaneous burst misses 300 ms |
| NFR-PERF-03 | Performance | scripts/prd-v20-performance.mjs | PARTIAL — continuous usage passes, 200-request instantaneous burst misses 800 ms |
| NFR-PERF-04 | Performance | scripts/prd-v20-performance.mjs | Mapped local evidence — inspect acceptance coverage |
| NFR-PERF-05 | Performance | scripts/prd-v20-performance.mjs | Mapped local evidence — inspect acceptance coverage |
| NFR-AVAIL-01 | Availability | scripts/database-restore-drill.mjs | EXTERNAL — monthly and pre-deadline availability require time and monitored hosting |
| NFR-AVAIL-02 | Resilience | scripts/database-restore-drill.mjs | PARTIAL — encrypted full restore passes locally; independent off-device backups/continuous RPO remain |
| NFR-SCALE-01 | Scalability | scripts/prd-v20-performance.mjs | PARTIAL — 200 students / 40 groups measured; 50 simultaneous populated classrooms not measured |
| NFR-SCALE-02 | Scalability | scripts/prd-v20-performance.mjs | PARTIAL — bounded 200-request burst measured; 10x deployed traffic not measured |
| NFR-COMPAT-01 | Compatibility | scripts/prd-v20-acceptance.mjs; scripts/day7-instructor-smoke.mjs | PARTIAL — Chromium/Firefox/WebKit; two released versions and real mobile devices remain |
| NFR-COMPAT-02 | Compatibility | scripts/prd-v20-acceptance.mjs; scripts/day7-instructor-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| NFR-OBS-01 | Observability | src/lib/observe-route.ts; src/proxy.ts; local structured logs | LOCAL — JSON request log and requestId verified on API responses |
| NFR-OBS-02 | Observability | src/lib/observe-route.ts; src/proxy.ts; local structured logs | PARTIAL — worker-local alert logs; five-minute fault injection and external alert routing remain |
| NFR-MAINT-01 | Maintainability | src/lib/full-system-scoring.test.ts; src/lib/prd-v20.test.ts | Mapped local evidence — inspect acceptance coverage |
| NFR-MAINT-02 | Maintainability | src/lib/full-system-scoring.test.ts; src/lib/prd-v20.test.ts | Mapped local evidence — inspect acceptance coverage |
| NFR-I18N-01 | Localization | src/lib/full-system-timezone.test.ts; scripts/day5-score-smoke.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PRIV-01 | M | scripts/prd-v20-acceptance.mjs; scripts/database-restore-drill.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PRIV-02 | M | scripts/prd-v20-acceptance.mjs; scripts/database-restore-drill.mjs | PARTIAL — inactive-account anonymization works; per-year identity separation for continuing users remains |
| FR-PRIV-03 | M | scripts/prd-v20-acceptance.mjs; scripts/database-restore-drill.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-PRIV-04 | M | scripts/prd-v20-acceptance.mjs; scripts/database-restore-drill.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-ANON-01 | M | src/lib/full-system-scoring.test.ts; scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-ANON-02 | M | src/lib/full-system-scoring.test.ts; scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-ANON-03 | M | src/lib/full-system-scoring.test.ts; scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-ANON-04 | M | src/lib/full-system-scoring.test.ts; scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-ANON-05 | M | src/lib/full-system-scoring.test.ts; scripts/day4-evaluation-smoke.mjs; scripts/prd-v20-acceptance.mjs | Mapped local evidence — inspect acceptance coverage |
| FR-SEC-01 | M | scripts/prd-v20-acceptance.mjs; source/security configuration review | EXTERNAL — HTTPS/HSTS/cookie code exists; localhost HTTP exception and no deployed TLS verification |
| FR-SEC-02 | M | scripts/prd-v20-acceptance.mjs; source/security configuration review | Mapped local evidence — inspect acceptance coverage |
| FR-SEC-03 | M | scripts/prd-v20-acceptance.mjs; source/security configuration review | Mapped local evidence — inspect acceptance coverage |
| FR-SEC-04 | M | scripts/prd-v20-acceptance.mjs; source/security configuration review | Mapped local evidence — inspect acceptance coverage |
| FR-SEC-05 | M | scripts/prd-v20-acceptance.mjs; source/security configuration review | Mapped local evidence — inspect acceptance coverage |
| FR-SEC-06 | M | scripts/prd-v20-acceptance.mjs; source/security configuration review | EXTERNAL — ignored local configuration; production secret-manager setup is not available |
| FR-SEC-07 | S | scripts/prd-v20-acceptance.mjs; source/security configuration review | PARTIAL SHOULD — production dependency audit in CI; no hosted secret-scanning observation |
| FR-A11Y-01 | M | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | Mapped local evidence — inspect acceptance coverage |
| FR-A11Y-02 | M | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | Mapped local evidence — inspect acceptance coverage |
| FR-A11Y-03 | M | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | PARTIAL — evaluation contrast and axe pass; full application/manual AA audit remains |
| FR-A11Y-04 | M | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | Mapped local evidence — inspect acceptance coverage |
| FR-A11Y-05 | M | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | PARTIAL — evaluation keyboard test; all flows manual audit remains |
| FR-A11Y-06 | M | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | Mapped local evidence — inspect acceptance coverage |
| FR-A11Y-07 | S | scripts/prd-v20-acceptance.mjs (axe + keyboard, evaluation page only) | EXTERNAL SHOULD — manual NVDA/VoiceOver session not performed |

INV-1 through INV-5: `src/lib/prd-v20.test.ts`, fast-check seed 20261015, 100 generated cohorts.

Unresolved PRD decisions: two-group evaluator feasibility; retaining generations instead of deleting submitted pairs; academic-year calendar and real-course friendship evidence.
