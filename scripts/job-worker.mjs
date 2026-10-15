import { existsSync } from "node:fs";
import { createBackup } from "./backup-core.mjs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const origin = process.env.APP_ORIGIN ?? "http://localhost:3101";
if (!process.env.CRON_SECRET || Buffer.byteLength(process.env.CRON_SECRET) < 16)
  throw new Error("CRON_SECRET required");
if (
  !/^https:/.test(origin) &&
  !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
)
  throw new Error("HTTPS is required outside localhost");
let stopped = false,
  lastPrivacyDay = "",
  lastBackup = 0;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
  });
async function call(name) {
  const r = await fetch(`${origin}/api/full-system/cron/${name}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(120000),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(`${name} HTTP ${r.status}`);
  console.log(
    JSON.stringify({
      event: "scheduled_job",
      job: name,
      status: "ok",
      time: new Date().toISOString(),
      result: result.data,
    }),
  );
}
do {
  try {
    await call("scores");
    await call("reminders");
    const day = new Date().toISOString().slice(0, 10);
    if (day !== lastPrivacyDay) {
      await call("privacy");
      lastPrivacyDay = day;
    }
    if (Date.now() - lastBackup >= 15 * 60000) {
      const backup = await createBackup(
        process.env.PAIR_EVAL_BACKUP_DIRECTORY || ".verification/backups",
      );
      console.log(JSON.stringify({ event: "database_backup", ...backup }));
      lastBackup = Date.now();
    }
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "scheduled_job_failure",
        time: new Date().toISOString(),
        message: e.message,
      }),
    );
  }
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => {
    const finish = () => {
      clearTimeout(delay);
      for (const signal of ["SIGINT", "SIGTERM"])
        process.removeListener(signal, finish);
      resolve();
    };
    const delay = setTimeout(finish, 60000 - (Date.now() % 60000));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, finish);
  });
} while (!stopped);
