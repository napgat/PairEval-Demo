# Post-Day-7 advisory quality signals

Date: 30 September 2026 (Asia/Bangkok). Synthetic student prototype only. S7/S8, Day 7 and Full System acceptance remain incomplete.

## Changes

- `QS-02`: most frequent forced-choice value divided by submitted answer count, separately per evaluator and side. Flag only when strictly greater than 80%.
- `QS-03`: most frequent displayed preference (left for choices 1–3, right for 4–6) divided by submitted answer count, separately per evaluator and side. Flag only when strictly greater than 80%. This measures display position even when canonical A/B is reversed.
- `QS-04`: directed preference cycles in complete three-item sets, separately per evaluator, side and criterion. Each complete triple counts once; the cycle fraction is flagged only when strictly greater than 20%. No complete triples means **not assessable**, not a clean result.
- The calculation uses the same current-generation/latest-submission inputs as scoring. Measurements are stored in each new snapshot and displayed in the instructor Quality tab, quality CSV and the Metadata sheet of the existing four-sheet XLSX. Older snapshots retain their old quality export shape and show that new signal evidence is absent.
- Evaluator codes are ordinal codes local to the snapshot. The quality object contains no evaluator UUID, email or display name. Codes are not a cross-snapshot identity link. Small samples show their denominator and require instructor review.
- `FR-QS-01`: signals are advisory and do not alter scores, answer weights, submitted answers or previous snapshots. The code does not exclude answers automatically.

## Evidence

- Unit tests: **88/88**, 21 files. New tests cover strict 80%/20% boundaries, display inversion, complete/incomplete triangles, criterion/evaluator separation, no-answer cases, identity omission, unchanged inputs/scores, old snapshot exports and XLSX signal evidence.
- Typecheck, lint and production build passed locally.
- `node scripts/day5-score-smoke.mjs development` exited 0, including fixture cleanup. It exercised persisted QS-02–04 measurement scope and identity omission, the instructor Quality tab, quality CSV, the existing four-sheet XLSX, score snapshot 1/2/3, override/history, Finalize/Reopen, appeals and outsider/student denials. The intentionally small fixture flags its one-answer QS-02 samples and reports QS-04 as not assessable; cycle/threshold cases have the unit evidence above.
- Staging smoke evidence: pending for this change.

## Open work

- QS-05 time collection stays disabled pending OQ-6; QS-06, QS-07 and repeated criterion feedback are not implemented. No complete Quality Report pass is claimed.
- Instructor exclusion with reason/recompute (`FR-QS-02`) is not implemented.
- The per-side scope of QS-02/03 and the snapshot-local report codes are documented implementation choices for review; the baseline PRD has not been silently revised.
- Other S7/S8, scheduled score recomputation, full security/accessibility and operational recovery gates remain as listed in [the preceding progress log](post-day-07-s7-s8-progress.md).
