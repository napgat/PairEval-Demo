# Post-Day-7 — QS05–07 synthetic verification

Date: 30 September 2026 (Asia/Bangkok). Development/staging synthetic prototype scope. This work does not close Full System, Day 7, S7/S8 or the policy decisions for real students.

## Implementation and statistical definitions

- New snapshots use `qs-02-07-synthetic-v2`. Existing snapshots keep their stored version and historical output. Signals remain advisory; they never change answer weights, participation or scores automatically.
- **QS05:** mean recorded active seconds per evaluator and side, strictly below 3 seconds. Every submitted answer must have a complete frozen measurement; otherwise the result is not assessable. No elapsed-time proxy from assignment publication, page load or Submit timestamps is used.
- Timing requires development/staging, explicit operator enrollment in `synthetic_quality_cohort`, and reserved synthetic addresses for every student in the classroom. The browser counts a focused, visible question, conservatively drops throttled gaps, and stops after 30 seconds without activity. Blur, hiding, moving out of view and page exit close the segment. Event sequence, evaluator/pair/generation scope, bounded increments, server wall-time budget and idempotent retries are checked. Open/unacknowledged segments yield NA when submitted. Only the current submitted revision's frozen duration is read by scoring.
- Timing is prototype telemetry, not proof of attention or a cheating detector. Multiple browser sessions and client tampering remain limitations. The synthetic smoke deletes all timing/cohort/friend records it creates. Real-user collection and retention remain disabled pending OQ-6.
- **QS06:** friendships come only from explicitly declared synthetic edges with provenance. Group membership does not imply friendship. An evaluator needs at least three comparisons with exactly one declared friend. The reference cohort needs at least five independent evaluators in the same group, each answering exactly those logical comparisons and declaring neither compared item a friend. Compare the evaluator's mean canonical friend credit to reference evaluator means using the sample standard deviation. Flag descriptive `z > 2`; zero variance, inadequate samples or missing provenance yield NA. This is a documented prototype model, not a hypothesis test or an approved population definition for real students.
- **QS07:** each included rater must answer every unordered pair for at least three items. Panels contain identical item sets and at least three complete raters. Sum integer preference credits per item, convert to midranks and calculate Kendall's W with tie correction. Flag `W < 0.2`; all-tied, undersized and incomplete panels yield NA. Missing votes are never imputed. A tolerance of `1e-12` prevents floating-point noise at strict thresholds.
- Quality objects and signal rows use snapshot-local evaluator codes and panel codes; they omit evaluator and friend identity. Instructor score/item summaries remain available within the existing instructor authorization scope. CSV includes comparison direction, reason and denominators; XLSX includes the same evidence in Metadata.

## Evidence

- Unit tests: **102/102**, 24 files, passed on 30 September 2026. Covers strict QS05/z/W boundaries, canonical display inversion, a numeric matched z example, sample/variance failures, valid midranks/ties, complete/sparse panels, identity omission and unchanged score arithmetic. The additional valid forced-choice fixture gives exact `z = 2` with no flag, then `z = 3` with a flag.
- Typecheck/lint and build passed for the integrated working tree. Deployment and staging runtime evidence must be recorded separately after the combined scheduler/quality revision is deployed.
- `scripts/post-day7-quality-smoke.mjs` exercises an explicitly enrolled synthetic classroom, real browser evaluation timing, immutable submitted timing, z/W snapshots, a 390px instructor Quality tab, CSV/XLSX signal evidence, role/enrollment/scope/sequence/bounds/replay denials, NA, immutable old snapshots, score invariance and transactional cleanup.
- First development attempt reached browser timing and numeric snapshot checks, then failed an overbroad export assertion that confused scored-item identity with evaluator identity. Fixture cleanup passed. The assertion now checks signal rows directly; the complete passing rerun is recorded below.
- Complete development rerun exited 0 with fixture cleanup: browser-recorded active duration **7,219 ms**, matched `z = 4.541868715470695` (3 comparisons, 5 reference raters), and `W = 0` (3 complete raters, 3 items). CSV/XLSX, 390px Quality tab, NA, unchanged score arithmetic and immutable historical snapshot checks passed. This run set the latest synthetic duration to NULL to exercise NA; the next verification additionally checks an open timing lease through actual Re-submit after batching recorder events.
- Final development rerun after batching recorder packets exited 0 with cleanup: active duration **8,222 ms**, the same matched z/W results, and **actual Re-submit with an open/unacknowledged lease** produced NA without changing scores or the old snapshot. Report screenshot: `paireval-development-qs05-07.png` in the task's visualization artifacts. Packet sampling remains every 500 ms while network batches are sent after approximately 3 seconds, reducing request backlog on a slower deployment.
- Quality implementation and smoke are ready to combine with scheduler implementation for a staging deployment; no separate quality deployment is claimed here.
- Development read-only audit outcome verification exited 0 after the final smoke: **314 committed, 3 historical rejected, pending 0**. The new smoke's own fixture cleanup exited 0, including active timing sessions and synthetic friend/cohort records.

## Remaining gates

- Staging smoke and deployment/CI evidence for this revision.
- Automatic scheduler invocation evidence; a manual authorized endpoint call is not evidence of automatic triggering.
- OQ-4 Registrar approval and versioned DQ-09 policy acceptance remain pending; no Registrar contact is available.
- OQ-6 real telemetry/retention approval, real friendship source and statistical policy acceptance are unresolved.
- FR-QS-03 repeated criterion feedback and cross-assignment criterion identity are not implemented.
- Complete security, accessibility and recovery gates remain open. Historical Day 7 failure is unchanged.

Method reference: [Kendall W documentation](https://andrisignorell.github.io/DescTools/reference/KendallW.html) distinguishes complete panels, ties and missing-data methods. The prototype uses complete panels with tie correction, without the missing-data extension.
