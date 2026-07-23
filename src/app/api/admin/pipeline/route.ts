import type { NextRequest } from "next/server";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getPipelineConfig, savePipelineConfig } from "@/lib/server/pipeline-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const identity = await requireRequestIdentity(request);
  if (identity.role !== "admin") throw new Error("Super Admin access is required.");
  return identity;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return Response.json({ config: await getPipelineConfig() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline settings could not be loaded.";
    return Response.json({ error: message }, { status: /sign in/i.test(message) ? 401 : 403 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const body = await request.json() as { config?: unknown };
    return Response.json({ config: await savePipelineConfig(body.config, identity.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline settings could not be saved.";
    const status = /sign in/i.test(message) ? 401 : /Super Admin/i.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
