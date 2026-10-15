import { createServer } from "node:http";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
process.loadEnvFile(".env.local");
if (
  process.env.PAIR_EVAL_ENV !== "development" ||
  new URL(process.env.DATABASE_URL).hostname !== "127.0.0.1"
)
  throw Error(
    "The presentation helper runs only on this laptop with synthetic local data",
  );
const origin = "http://localhost:3101",
  portal = "http://localhost:3103",
  file = ".verification/v20-20261015/presentation-state.json",
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
let state;
try {
  state = JSON.parse(await readFile(file, "utf8"));
  if (
    !(await pool.query("SELECT 1 FROM classroom WHERE id=$1", [state.room]))
      .rowCount
  )
    state = null;
} catch {}
const labels = {
  owner: "อาจารย์เจ้าของห้อง",
  co: "ผู้สอนร่วม",
  ta: "ผู้ช่วยสอน",
  s0: "นักศึกษาคนที่ 1",
  s1: "นักศึกษาคนที่ 2",
};
if (!state) {
  const names = [
      "owner",
      "co",
      "ta",
      ...Array.from({ length: 16 }, (_, i) => "s" + i),
    ],
    users = Object.fromEntries(
      names.map((a) => [
        a,
        { id: randomUUID(), token: randomBytes(32).toString("hex") },
      ]),
    );
  for (const [a, u] of Object.entries(users)) {
    const email = `v20-presentation-${a}@example.test`;
    await pool.query(
      "INSERT INTO app_user(id,email_lookup,email_raw,display_name,status,can_create_classroom)VALUES($1,$2,$2,$3,'ACTIVE',$4)",
      [
        u.id,
        email,
        labels[a] ?? `นักศึกษาจำลอง ${Number(a.slice(1)) + 1}`,
        a === "owner",
      ],
    );
    await pool.query(
      "INSERT INTO privacy_notice_acceptance(user_id,notice_version)VALUES($1,'prd-v2.0-privacy-20261015')",
      [u.id],
    );
  }
  async function api(path, actor = "owner", method = "GET", body) {
    const r = await fetch(origin + path, {
      method,
      headers: {
        Cookie: `paireval_full_session=${users[actor].token}`,
        Origin: origin,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw Error(path + ": " + JSON.stringify(j));
    return j.data;
  }
  for (const u of Object.values(users))
    await pool.query(
      "INSERT INTO app_session(id,user_id,token_hash,expires_at)VALUES($1,$2,$3,now()+interval '12 hours')",
      [randomUUID(), u.id, createHash("sha256").update(u.token).digest("hex")],
    );
  const csv = [
    "email,group_name,student_id,display_name",
    ...names
      .filter((a) => a.startsWith("s"))
      .map(
        (a, i) =>
          `v20-presentation-${a}@example.test,กลุ่ม ${Math.floor(i / 4) + 1},S${String(i + 1).padStart(3, "0")},นักศึกษาจำลอง ${i + 1}`,
      ),
  ].join("\n");
  const room = (
    await api("/api/classrooms", "owner", "POST", {
      name: "PairEval · สาธิต PRD v2.0",
      csv,
    })
  ).id;
  for (const [a, role] of [
    ["co", "CO_TEACHER"],
    ["ta", "TA"],
  ])
    await pool.query(
      "INSERT INTO classroom_member(id,classroom_id,user_id,role)VALUES($1,$2,$3,$4)",
      [randomUUID(), room, users[a].id, role],
    );
  const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
  const assignment = (
    await api("/api/assignments", "owner", "POST", {
      classroomId: room,
      name: "ประเมินผลงานโครงงาน — ข้อมูลจำลอง",
      description:
        "สาธิตการประเมิน 2 ด้าน สูตรคะแนน PRD v2.0 และสิทธิ์แต่ละบทบาท",
      artifactOverviewUrl: "https://example.com/",
      groupMaxScore: 15,
      individualMaxScore: 5,
      groupDeadline: deadline,
      individualDeadline: deadline,
      targetCoverage: 3,
      maxWorkload: 8,
      criteria: [
        {
          side: "GROUP",
          name: "คุณภาพผลงาน",
          description: "ความถูกต้องและความครบถ้วนของชิ้นงาน",
          weightPct: 60,
        },
        {
          side: "GROUP",
          name: "การนำเสนอ",
          description: "ความชัดเจนของหลักฐานและคำอธิบาย",
          weightPct: 40,
        },
        {
          side: "INDIVIDUAL",
          name: "ความร่วมมือ",
          description: "การรับผิดชอบหน้าที่และการช่วยเหลือทีม",
          weightPct: 100,
        },
      ],
    })
  ).id;
  await api(`/api/assignments/${assignment}:publish`, "owner", "POST", {
    seed: "20261015",
  });
  for (let i = 1; i < 16; i++)
    for (const side of ["GROUP", "INDIVIDUAL"]) {
      const a = "s" + i,
        e = await api(
          `/api/assignments/${assignment}/my-evaluations?side=${side}`,
          a,
        );
      for (const [n, p] of e.pairs.entries())
        await api(`/api/comparisons/${p.id}`, a, "PUT", {
          choice: 2 + ((i + n) % 4),
        });
      await api(`/api/assignments/${assignment}/submissions`, a, "POST", {
        side,
      });
    }
  await api(`/api/assignments/${assignment}:recompute`, "owner", "POST", {});
  state = {
    format: "synthetic-local-presentation-v1",
    room,
    assignment,
    users,
  };
  await mkdir(".verification/v20-20261015", { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log(
    "Prepared a persistent synthetic classroom with 16 students; student 1 is intentionally left to evaluate live",
  );
}
if (state.artifactsVersion !== 1) {
  // Operator preparation of this named synthetic fixture, before live demonstration.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = (
      await client.query(
        "SELECT 1 FROM assignment a JOIN classroom c ON c.id=a.classroom_id WHERE a.id=$1 AND c.id=$2 AND c.name='PairEval · สาธิต PRD v2.0'",
        [state.assignment, state.room],
      )
    ).rowCount;
    if (!row) throw Error("Synthetic presentation namespace guard failed");
    const links = new Map();
    for (const g of (
      await client.query(
        "SELECT id,name FROM group_entity WHERE classroom_id=$1",
        [state.room],
      )
    ).rows)
      links.set(
        g.id,
        origin + "/demo-artifacts/group-" + g.name.match(/\d+$/)[0] + ".html",
      );
    for (const [a, u] of Object.entries(state.users))
      if (a.startsWith("s"))
        links.set(
          u.id,
          origin +
            "/demo-artifacts/student-" +
            (Number(a.slice(1)) + 1) +
            ".html",
        );
    const pairs = (
      await client.query(
        "SELECT id,side,group_a_id,group_b_id,student_a_id,student_b_id,display_left FROM pair_assignment WHERE assignment_id=$1",
        [state.assignment],
      )
    ).rows;
    for (const p of pairs) {
      const a = p.side === "GROUP" ? p.group_a_id : p.student_a_id,
        b = p.side === "GROUP" ? p.group_b_id : p.student_b_id;
      await client.query(
        "UPDATE pair_assignment SET left_artifact_url=$2,right_artifact_url=$3 WHERE id=$1",
        [
          p.id,
          links.get(p.display_left === "A" ? a : b),
          links.get(p.display_left === "A" ? b : a),
        ],
      );
    }
    await client.query(
      "UPDATE assignment SET artifact_overview_url=$2 WHERE id=$1",
      [state.assignment, origin + "/demo-artifacts/index.html"],
    );
    for (const [id, url] of links) {
      if (Object.values(state.users).some((u) => u.id === id))
        await client.query(
          "INSERT INTO individual_artifact(id,assignment_id,student_user_id,artifact_url)VALUES($1,$2,$3,$4) ON CONFLICT(assignment_id,student_user_id)DO UPDATE SET artifact_url=EXCLUDED.artifact_url",
          [randomUUID(), state.assignment, id, url],
        );
      else
        await client.query(
          "INSERT INTO group_artifact(id,assignment_id,group_id,artifact_url)VALUES($1,$2,$3,$4) ON CONFLICT(assignment_id,group_id)DO UPDATE SET artifact_url=EXCLUDED.artifact_url",
          [randomUUID(), state.assignment, id, url],
        );
    }
    await client.query("COMMIT");
    state.artifactsVersion = 1;
    await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function login(res, role, target = "/full-system") {
  const u = state.users[role];
  if (!u || !Object.hasOwn(labels, role)) {
    res.writeHead(404);
    return res.end();
  }
  const token = randomBytes(32).toString("hex");
  await pool.query("DELETE FROM app_session WHERE user_id=$1", [u.id]);
  await pool.query(
    "INSERT INTO app_session(id,user_id,token_hash,expires_at)VALUES($1,$2,$3,now()+interval '12 hours')",
    [randomUUID(), u.id, createHash("sha256").update(token).digest("hex")],
  );
  res.writeHead(303, {
    "Set-Cookie": `paireval_full_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
    Location: origin + target,
    "Cache-Control": "no-store",
  });
  res.end();
}
const server = createServer(async (req, res) => {
  try {
    if (
      req.headers.host !== "localhost:3103" &&
      req.headers.host !== "127.0.0.1:3103"
    ) {
      res.writeHead(403);
      return res.end();
    }
    const url = new URL(req.url, portal);
    if (req.method === "POST" && url.pathname === "/enter") {
      if (req.headers.origin !== portal) {
        res.writeHead(403);
        return res.end();
      }
      let body = "";
      for await (const data of req) {
        body += data;
        if (body.length > 2000) throw Error("Request too large");
      }
      const form = new URLSearchParams(body);
      return await login(res, form.get("role"));
    }
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", synthetic: true }));
    }
    if (req.method !== "GET" || url.pathname !== "/") {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://localhost:3101; frame-ancestors 'none'",
    });
    res.end(
      `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PairEval · ชุดสาธิต v2.0</title><style>*{box-sizing:border-box}body{font:17px/1.7 system-ui,sans-serif;background:#eef5f4;color:#203c40;max-width:920px;margin:40px auto;padding:20px}h1{line-height:1.35}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}article{padding:24px;border:1px solid #c8d9d6;border-radius:18px;background:white}button{width:100%;padding:14px;font:inherit;background:#096b62;color:white;border:0;border-radius:10px;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #121212;outline-offset:4px}small{color:#496267}a{color:#075f58}ol{padding-left:24px}</style><main><small>ข้อมูลจำลองบนโน้ตบุ๊ก · PRD v2.0</small><h1>PairEval พร้อมสาธิต</h1><p>เลือกบทบาทเพื่อเข้าใช้งานระบบจริงในเครื่อง เปลี่ยนบทบาทได้โดยกลับมาหน้านี้</p><div class="cards">${Object.entries(
        labels,
      )
        .map(
          ([role, label]) =>
            `<article><h2>${escape(label)}</h2><form method="post" action="/enter"><input type="hidden" name="role" value="${role}"><button>เข้าใช้ในบทบาทนี้</button></form></article>`,
        )
        .join(
          "",
        )}</div><h2>ลำดับการสาธิต</h2><ol><li>อาจารย์: เปิดห้องเรียน ดูงาน เกณฑ์ และรายงานชั่วคราว</li><li>นักศึกษาคนที่ 1: เปิดผลงาน เปรียบเทียบ บันทึก และยืนยันส่งทั้งสองด้าน</li><li>อาจารย์: คำนวณใหม่ ตรวจ p/M และส่งออกไฟล์</li><li>ผู้ช่วยสอน: ตรวจรายชื่อ ส่วนผู้สอนร่วมเปิดดูรายงานได้</li></ol><p>ผลงานจำลองกลุ่มและรายบุคคลเปิดได้ในเครื่องนี้ จึงสาธิตเส้นทางหลักได้เมื่อไม่ได้เชื่อมต่ออินเทอร์เน็ต</p><p><a href="https://github.com/CE-SDPX/SDPX-AI/blob/main/project-ideas/pairwise_evaluation_prd.md">PRD ของอาจารย์</a></p></main></html>`,
    );
  } catch (e) {
    console.error("Presentation helper failed: " + e.message);
    res.writeHead(500);
    res.end("Presentation helper failed");
  }
});
server.listen(3103, "127.0.0.1", () =>
  console.log("Presentation portal ready: http://localhost:3103"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit();
    }),
  );
