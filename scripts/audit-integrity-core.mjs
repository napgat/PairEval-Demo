import { createHash } from "node:crypto";

const fields = ["id", "classroom_id", "assignment_id", "actor_user_id", "action", "resource_type",
  "resource_id", "before_json", "after_json", "reason", "ip_address", "request_id", "occurred_at"];

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value ?? null;
}

export function canonicalAuditEvent(event) {
  return JSON.stringify(Object.fromEntries(fields.map(field => [field, stable(event[field])])));
}

export function computeAuditCheckpoint(events) {
  let digest = "0".repeat(64);
  let previousKey = "";
  for (const event of events) {
    const occurredAt = event.occurred_at instanceof Date ? event.occurred_at.toISOString() : event.occurred_at;
    const key = `${occurredAt}/${event.id}`;
    if (previousKey && key <= previousKey) throw new Error("Audit rows are not strictly ordered");
    previousKey = key;
    digest = createHash("sha256").update(`${digest}\n${canonicalAuditEvent(event)}`, "utf8").digest("hex");
  }
  return { rowCount: events.length, highWatermark: events.length ? {
    occurredAt: events.at(-1).occurred_at instanceof Date ? events.at(-1).occurred_at.toISOString() : events.at(-1).occurred_at,
    id: events.at(-1).id,
  } : null, chainSha256: digest };
}

export function checkpointPrefix(events, highWatermark) {
  if (!highWatermark) return [];
  const limit = `${highWatermark.occurredAt}/${highWatermark.id}`;
  return events.filter(event => {
    const occurredAt = event.occurred_at instanceof Date ? event.occurred_at.toISOString() : event.occurred_at;
    return `${occurredAt}/${event.id}` <= limit;
  });
}
