import { Pool } from "pg";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { cleanupFixture } from "./fixture-cleanup.mjs";
process.loadEnvFile(".env.local");
if (
  new URL(process.env.DATABASE_URL).hostname !== "127.0.0.1" ||
  process.env.PAIR_EVAL_ENV !== "development"
)
  throw Error("Local synthetic load only");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 }),
  origin = "http://localhost:3101",
  prefix = "v20-perf-" + randomUUID().slice(0, 8);
const users = Array.from({ length: 201 }, (_, i) => ({
  id: randomUUID(),
  email: `${prefix}-${i}@example.test`,
  token: randomBytes(32).toString("hex"),
}));
let room, assignment;
const metrics = {
  machine: "local laptop, isolated PostgreSQL, production Next build",
  concurrentUsers: 200,
  criteria: 5,
  groups: 40,
  groupSize: 5,
};
async function call(path, user = users[0], method = "GET", body) {
  const start = performance.now();
  const r = await fetch(origin + path, {
    method,
    headers: {
      Cookie: `paireval_full_session=${user.token}`,
      Origin: origin,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (r.status >= 400) throw Error(`${r.status} ${data.error?.code}`);
  return { data: data.data, ms: performance.now() - start };
}
const stats = (rows) => {
  const a = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    n: a.length,
    p50Ms: +a[Math.ceil(a.length * 0.5) - 1].toFixed(2),
    p95Ms: +a[Math.ceil(a.length * 0.95) - 1].toFixed(2),
    p99Ms: +a[Math.ceil(a.length * 0.99) - 1].toFixed(2),
    maxMs: +a.at(-1).toFixed(2),
  };
};
try {
  await pool.query(
    `INSERT INTO app_user(id,email_lookup,email_raw,display_name,status,can_create_classroom)
 SELECT (x->>'id')::uuid,x->>'email',x->>'email','Synthetic load student','ACTIVE',x->>'id'=$2 FROM jsonb_array_elements($1::jsonb)x`,
    [
      JSON.stringify(users.map(({ id, email }) => ({ id, email }))),
      users[0].id,
    ],
  );
  for (const u of users) {
    await pool.query(
      "INSERT INTO privacy_notice_acceptance(user_id,notice_version)VALUES($1,'prd-v2.0-privacy-20261015')",
      [u.id],
    );
    await pool.query(
      "INSERT INTO app_session(id,user_id,token_hash,expires_at)VALUES($1,$2,$3,now()+interval '1 hour')",
      [randomUUID(), u.id, createHash("sha256").update(u.token).digest("hex")],
    );
  }
  const csv = [
    "email,group_name",
    ...users.slice(1).map((u, i) => `${u.email},G${Math.floor(i / 5)}`),
  ].join("\n");
  room = (
    await call("/api/classrooms", users[0], "POST", {
      name: `Synthetic performance ${prefix}`,
      csv,
    })
  ).data.id;
  const deadline = new Date(Date.now() + 86400000).toISOString();
  assignment = (
    await call("/api/assignments", users[0], "POST", {
      classroomId: room,
      name: "200 students × 5 criteria",
      groupMaxScore: 15,
      individualMaxScore: 5,
      groupDeadline: deadline,
      individualDeadline: deadline,
      targetCoverage: 3,
      maxWorkload: 8,
      criteria: [
        { side: "GROUP", name: "g1", weightPct: 40 },
        { side: "GROUP", name: "g2", weightPct: 35 },
        { side: "GROUP", name: "g3", weightPct: 25 },
        { side: "INDIVIDUAL", name: "i1", weightPct: 50 },
        { side: "INDIVIDUAL", name: "i2", weightPct: 50 },
      ],
    })
  ).data.id;
  const published = await call(
    `/api/assignments/${assignment}:publish`,
    users[0],
    "POST",
    { seed: "20261015" },
  );
  metrics.pairGenerationMs = +published.ms.toFixed(2);
  metrics.comparisons = published.data.assignmentCount;
  const path = `/api/assignments/${assignment}/my-evaluations?side=GROUP`;
  await call(path, users[1]);
  const reads = await Promise.all(users.slice(1).map((u) => call(path, u)));
  metrics.evaluationApi = stats(reads);
  const writes = await Promise.all(
    users
      .slice(1)
      .map((u, i) =>
        call(`/api/comparisons/${reads[i].data.pairs[0].id}`, u, "PUT", {
          choice: 3,
        }),
      ),
  );
  metrics.autosave = stats(writes);
  const submissions = await Promise.all(
    users
      .slice(1)
      .map((u) =>
        call(`/api/assignments/${assignment}/submissions`, u, "POST", {
          side: "GROUP",
        }),
      ),
  );
  metrics.submission = stats(submissions);
  const spread = async (job) =>
    Promise.all(
      users
        .slice(1)
        .map((u, i) =>
          new Promise((resolve) => setTimeout(resolve, i * 10)).then(() =>
            job(u, i),
          ),
        ),
    );
  metrics.continuousUsage = {
    profile:
      "200 authenticated users, one action per user over each 2-second autosave period (100 requests/second)",
    autosave: stats(
      await spread((u, i) =>
        call(`/api/comparisons/${reads[i].data.pairs[0].id}`, u, "PUT", {
          choice: 4,
        }),
      ),
    ),
    submission: stats(
      await spread((u) =>
        call(`/api/assignments/${assignment}/submissions`, u, "POST", {
          side: "GROUP",
        }),
      ),
    ),
  };
  metrics.recomputeMs = +(
    await call(`/api/assignments/${assignment}:recompute`, users[0], "POST", {})
  ).ms.toFixed(2);
  metrics.acceptance = {
    pairGeneration: metrics.pairGenerationMs <= 10000,
    evaluationApi:
      metrics.evaluationApi.p95Ms <= 2000 &&
      metrics.evaluationApi.p99Ms <= 4000,
    autosave: metrics.continuousUsage.autosave.p95Ms <= 300,
    submission: metrics.continuousUsage.submission.p95Ms <= 800,
    recompute: metrics.recomputeMs <= 30000,
  };
  metrics.burstAcceptance = {
    autosave: metrics.autosave.p95Ms <= 300,
    submission: metrics.submission.p95Ms <= 800,
  };
  console.log(JSON.stringify(metrics, null, 2));
  if (Object.values(metrics.acceptance).some((v) => !v)) process.exitCode = 1;
} finally {
  if (room) await cleanupFixture(pool, room);
  const ids = users.map((u) => u.id);
  for (const table of ["app_session", "privacy_notice_acceptance"])
    await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])`, [
      ids,
    ]);
  await pool.query("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [ids]);
  await writeFile(
    ".verification/v20-20261015/performance.json",
    JSON.stringify(metrics, null, 2),
  );
  await pool.end();
}
