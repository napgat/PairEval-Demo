import { observeRoute } from "@/lib/observe-route";
function GETHandler() {
  return Response.json({ status: "ok" });
}

export const GET = observeRoute(GETHandler);
