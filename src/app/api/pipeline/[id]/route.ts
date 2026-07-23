import type { PipelineStepAction } from "@/lib/media-pipeline-types";
import { getMediaPipelineRun, transitionMediaPipelineStep } from "@/lib/server/media-pipeline";

export const runtime = "nodejs";

const actions: PipelineStepAction[] = ["queue", "start", "complete", "approve", "reject", "retry", "fail", "skip", "cancel"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = await getMediaPipelineRun(id);
    if (!run) return Response.json({ error: "Media pipeline not found." }, { status: 404 });
    return Response.json({ run }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load media pipeline." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.stepKey !== "string" || !body.stepKey.trim()) throw new Error("Step key is required.");
    if (typeof body.action !== "string" || !actions.includes(body.action as PipelineStepAction)) {
      throw new Error("Unknown pipeline step action.");
    }
    const run = await transitionMediaPipelineStep({
      runId: id,
      stepKey: body.stepKey.trim(),
      action: body.action as PipelineStepAction,
      output: body.output && typeof body.output === "object" && !Array.isArray(body.output)
        ? body.output as Record<string, unknown>
        : undefined,
      outputAssetId: typeof body.outputAssetId === "string" ? body.outputAssetId : undefined,
      errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : undefined,
    });
    return Response.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update media pipeline.";
    return Response.json({ error: message }, { status: /required|unknown|cannot/i.test(message) ? 400 : 500 });
  }
}
