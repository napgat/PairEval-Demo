import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";

export type RequestContext = {
  ipAddress: string | null;
  requestId: string;
  rateChecked?: boolean;
  path?: string;
};
const requests = new AsyncLocalStorage<RequestContext>();

export function captureRequestContext(request: NextRequest): void {
  if (requests.getStore()) return;
  requests.enterWith(contextFor(request));
}
function contextFor(request: NextRequest): RequestContext {
  const trusted =
    process.env.VERCEL === "1" || process.env.PAIR_EVAL_TRUST_PROXY === "1";
  const forwarded = trusted
    ? (
        request.headers.get("x-vercel-forwarded-for") ??
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip")
      )
        ?.split(",")[0]
        .trim()
    : null;
  const host = new URL(request.url).hostname;
  const ipAddress =
    forwarded && isIP(forwarded)
      ? forwarded
      : ["localhost", "127.0.0.1", "[::1]"].includes(host)
        ? "127.0.0.1"
        : null;
  const provided = request.headers.get("x-paireval-request-id");
  return {
    ipAddress,
    requestId:
      provided && /^[0-9a-f-]{36}$/.test(provided) ? provided : randomUUID(),
    path: new URL(request.url).pathname,
  };
}

export function runWithRequest<T>(request: NextRequest, work: () => T): T {
  return requests.run(contextFor(request), work);
}
export function currentRequestContext(): RequestContext {
  return requests.getStore() ?? { ipAddress: null, requestId: randomUUID() };
}
