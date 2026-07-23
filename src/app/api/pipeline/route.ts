import { MEDIA_OUTPUT_CATALOG } from "@/lib/media-output-definitions";
import type { MediaOutputType, PipelineScope } from "@/lib/media-pipeline-types";
import { createMediaPipelineRun, listMediaPipelineRuns } from "@/lib/server/media-pipeline";

export const runtime = "nodejs";

const scopes: PipelineScope[] = ["actor", "shot", "episode", "spot"];
const outputTypes = new Set(MEDIA_OUTPUT_CATALOG.map((item) => item.type));

function cleanString(value: unknown, field: string, max = 300) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function parseScope(value: unknown): PipelineScope {
  const scope = cleanString(value, "Pipeline scope", 20) as PipelineScope;
  if (!scopes.includes(scope)) throw new Error("Unknown pipeline scope.");
  return scope;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeType = parseScope(url.searchParams.get("scopeType"));
    const scopeId = cleanString(url.searchParams.get("scopeId"), "Scope ID");
    return Response.json({
      runs: await listMediaPipelineRuns(scopeType, scopeId),
      catalog: MEDIA_OUTPUT_CATALOG,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load media pipelines." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const outputType = cleanString(body.outputType, "Output type", 40) as MediaOutputType;
    if (!outputTypes.has(outputType)) throw new Error("Unknown output type.");
    const spec = body.spec && typeof body.spec === "object" && !Array.isArray(body.spec)
      ? body.spec as Record<string, unknown>
      : {};
    const run = await createMediaPipelineRun({
      scopeType: parseScope(body.scopeType),
      scopeId: cleanString(body.scopeId, "Scope ID"),
      outputType,
      spec,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : null,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    });
    return Response.json({ run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create media pipeline.";
    return Response.json({ error: message }, { status: /required|unknown|requires/i.test(message) ? 400 : 500 });
  }
}
