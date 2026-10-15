import type { NextRequest } from "next/server";
import { currentRequestContext, runWithRequest } from "./request-context";
import { RateLimitError } from "./full-system-rate-limit";

const samples: Array<{
  at: number;
  ms: number;
  error: boolean;
  target: number;
}> = [];
let lastAlert = 0;
function record(ms: number, status: number, path: string) {
  const now = Date.now(),
    target = path.includes("/evaluation/")
      ? 300
      : path.includes("/submissions")
        ? 800
        : 2000;
  samples.push({ at: now, ms, error: status >= 500, target });
  while (
    samples.length &&
    (samples[0].at < now - 300000 || samples.length > 50000)
  )
    samples.shift();
  if (
    samples.length < 20 ||
    now - samples[0].at < 295000 ||
    now - lastAlert < 60000
  )
    return;
  const errors = samples.filter((s) => s.error).length / samples.length;
  const ratios = samples.map((s) => s.ms / s.target).sort((a, b) => a - b);
  const ratio = ratios[Math.ceil(ratios.length * 0.95) - 1];
  if (errors > 0.01 || ratio > 2) {
    console.error(
      JSON.stringify({
        event: "service_alert",
        windowSeconds: 300,
        errorRate: errors,
        p95TargetRatio: ratio,
      }),
    );
    lastAlert = now;
  }
}
/** No query strings, cookies, bodies, or identities are written to request logs. */
export function observeRoute<C>(
  handler: (request: NextRequest, context: C) => Response | Promise<Response>,
) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    if (currentRequestContext().path) return handler(request, context);
    return runWithRequest(request, async () => {
      const started = performance.now(),
        ctx = currentRequestContext();
      let response: Response;
      try {
        response = await handler(request, context);
      } catch (error) {
        const status =
          error instanceof RateLimitError
            ? 429
            : error instanceof SyntaxError
              ? 400
              : 500;
        response = Response.json(
          {
            error: {
              code:
                status === 429
                  ? "RATE_LIMITED"
                  : status === 400
                    ? "INVALID_JSON"
                    : "INTERNAL_ERROR",
            },
          },
          {
            status,
            headers:
              error instanceof RateLimitError
                ? { "Retry-After": String(error.retryAfter) }
                : {},
          },
        );
      }
      const headers = new Headers(response.headers);
      headers.set("X-Request-ID", ctx.requestId);
      if (
        headers.get("Content-Type")?.includes("application/json") &&
        response.status >= 400
      ) {
        const data = await response.json();
        const error =
          typeof data.error === "object" && data.error
            ? data.error
            : {
                code: "REQUEST_FAILED",
                message: String(data.error ?? "Request failed"),
              };
        response = Response.json(
          {
            ...data,
            error: {
              message: error.code,
              field: null,
              ...error,
              requestId: ctx.requestId,
            },
          },
          { status: response.status, headers },
        );
      } else
        response = new Response(response.body, {
          status: response.status,
          headers,
        });
      const ms = Math.round((performance.now() - started) * 100) / 100;
      console.log(
        JSON.stringify({
          event: "http_request",
          requestId: ctx.requestId,
          method: request.method,
          path: ctx.path,
          status: response.status,
          durationMs: ms,
        }),
      );
      record(ms, response.status, ctx.path ?? "");
      return response;
    });
  };
}
