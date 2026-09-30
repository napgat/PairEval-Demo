// Reuses the synthetic Day 5 fixture and cleanup, with the OQ-4 package enabled.
process.env.PAIR_EVAL_WITHDRAWAL_SMOKE = "1";
process.env.PAIR_EVAL_REVIEW_SMOKE = "1";
await import("./day5-score-smoke.mjs");
