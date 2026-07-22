import { getSeriesDetail } from "@/lib/server/series";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/series/[id]">) {
  try {
    const { id } = await context.params;
    const series = await getSeriesDetail(id);
    if (!series) return Response.json({ error: "Series not found." }, { status: 404 });
    return Response.json({ series }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the series." }, { status: 500 });
  }
}

