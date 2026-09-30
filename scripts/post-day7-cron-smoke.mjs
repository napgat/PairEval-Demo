const environment = process.argv[2];
if (environment !== "development") throw new Error("This bounded local smoke uses development only");
process.loadEnvFile(".env.local");
if (process.env.PAIR_EVAL_ENV !== "development" || !process.env.CRON_SECRET) {
  throw new Error("Development cron guard failed");
}
const url = "http://localhost:3101/api/full-system/cron/reminders";
const denied = await fetch(url, { headers: { Authorization: "Bearer wrong" } });
if (denied.status !== 404) throw new Error(`Invalid cron token returned ${denied.status}`);
const authorized = await fetch(url, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
const body = await authorized.json();
if (authorized.status !== 200 || typeof body.data?.due !== "number" ||
    typeof body.data?.inserted !== "number" || body.data.inserted > body.data.due) {
  throw new Error(`Authorized cron sweep failed: ${authorized.status} ${body.error?.code ?? ""}`);
}
console.log(`development reminder cron smoke passed: due=${body.data.due}, inserted=${body.data.inserted}`);
