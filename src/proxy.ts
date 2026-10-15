import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID(),
    headers = new Headers(request.headers);
  const early = (response: NextResponse) => {
    response.headers.set("X-Request-ID", requestId);
    console.log(
      JSON.stringify({
        event: "http_request",
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status,
        durationMs: 0,
      }),
    );
    return response;
  };
  if (process.env.PAIR_EVAL_ENV === "production") {
    if (/^\/(demo(?:\/|$)|api\/demo(?:\/|$))/.test(request.nextUrl.pathname))
      return early(
        NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Not found",
              field: null,
              requestId,
            },
          },
          { status: 404 },
        ),
      );
    if (request.nextUrl.pathname === "/")
      return early(NextResponse.redirect(new URL("/full-system", request.url)));
    if (
      request.nextUrl.pathname.startsWith("/full-system") &&
      !request.cookies.has("paireval_full_session")
    )
      return early(
        NextResponse.redirect(new URL("/api/auth/oidc/start", request.url)),
      );
  }
  headers.set("x-paireval-request-id", requestId);
  const canonical =
    /^\/api\/(classrooms|assignments|comparisons|appeals)(?:\/|$)/.test(
      request.nextUrl.pathname,
    ) &&
    (process.env.PAIR_EVAL_ENV === "production" ||
      request.cookies.has("paireval_full_session") ||
      !request.cookies.has("paireval_demo_session"));
  const target = request.nextUrl.clone();
  target.pathname = `/api/prd/${request.nextUrl.pathname.slice(5)}`;
  const response = canonical
    ? NextResponse.rewrite(target, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.headers.set("X-Request-ID", requestId);
  if (!request.nextUrl.pathname.startsWith("/api/"))
    console.log(
      JSON.stringify({
        event: "page_request",
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
      }),
    );
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
