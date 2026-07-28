import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { requireRequestIdentity } from "@/lib/server/auth";
import {
  assertRequestBodySize,
  enforceRateLimit,
  securityErrorStatus,
} from "@/lib/server/request-security";

export const runtime = "nodejs";

// Concierge speed telemetry: every session posts its per-step timings here so
// we can see exactly how fast understanding → building feels, and improve it.
// Rows land in generation_jobs (kind "concierge-telemetry") → /admin/logs.
export async function POST(request: Request) {
  try {
    assertRequestBodySize(request, 32 * 1024);
    const identity = await requireRequestIdentity(request);
    await enforceRateLimit({
      request,
      bucket: "concierge-telemetry",
      limit: 120,
      windowSeconds: 60 * 60,
      identityId: identity.id,
    });
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    mode?: string;
    steps?: Array<{ label: string; ms: number }>;
    outcome?: string;
  };
  const steps = Array.isArray(body.steps) ? body.steps.slice(0, 40) : [];
  const totalMs = steps.reduce((sum, step) => sum + (Number(step.ms) || 0), 0);
  console.log(
    `[concierge-telemetry] session=${body.sessionId ?? "-"} mode=${body.mode ?? "-"} outcome=${body.outcome ?? "-"} total=${totalMs}ms ` +
      steps.map((step) => `${step.label}:${Math.round(step.ms)}ms`).join(" ")
  );
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("generation_jobs").insert({
      character_id: null,
      kind: "concierge-telemetry",
      provider: body.mode === "eleven" ? "elevenlabs" : "chaplin",
      model: body.mode ?? "unknown",
      prompt: body.outcome ?? null,
      status: "succeeded",
      metadata: { sessionId: body.sessionId, steps, totalMs },
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[concierge-telemetry] log skipped:", error instanceof Error ? error.message : error);
  }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telemetry request failed.";
    return Response.json(
      { error: message },
      { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 400) },
    );
  }
}
