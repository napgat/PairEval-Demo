import { databasePool } from "./full-system-postgres";
import { currentRequestContext } from "./request-context";

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("Request limit exceeded");
  }
}
/** Shared PostgreSQL counters survive workers/restarts. Exports also count toward the general limit. */
export async function enforceUserLimit(userId: string): Promise<void> {
  const context = currentRequestContext();
  if (context.rateChecked) return;
  context.rateChecked = true;
  const buckets = [
    "requests",
    ...(context.path?.includes("/exports") ||
    context.path?.endsWith("/raw-pairs")
      ? ["exports"]
      : []),
  ];
  for (const bucket of buckets) {
    const count = await databasePool().query<{ n: number; retry: number }>(
      `INSERT INTO api_rate_window(user_id,bucket,window_start,n)
      VALUES($1,$2,date_trunc('minute',clock_timestamp()),1)
      ON CONFLICT(user_id,bucket,window_start) DO UPDATE SET n=api_rate_window.n+1
      RETURNING n,ceil(extract(epoch FROM window_start+interval '1 minute'-clock_timestamp()))::integer AS retry`,
      [userId, bucket],
    );
    if (count.rows[0].n > (bucket === "exports" ? 5 : 120))
      throw new RateLimitError(Math.max(1, count.rows[0].retry));
  }
}
