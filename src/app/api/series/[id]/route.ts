import { getSeriesDetail } from "@/lib/server/series";
import { requireRequestIdentity } from "@/lib/server/auth";
import { securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/series/[id]">) {
  try {
    const identity = await requireRequestIdentity(request);
    const { id } = await context.params;
    const series = await getSeriesDetail(id);
    if (!series) return Response.json({ error: "Series not found." }, { status: 404 });
    if (identity.role !== "admin" && series.ownerId !== identity.id) {
      return Response.json({ error: "Series not found." }, { status: 404 });
    }
    return Response.json({ series }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the series.";
    return Response.json(
      { error: message },
      { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 500) },
    );
  }
}
