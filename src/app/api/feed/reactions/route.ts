import { NextRequest } from "next/server";
import { toggleFeedReaction } from "@/lib/server/feed";
import { requireRequestIdentity } from "@/lib/server/auth";
import { assertRequestBodySize, enforceRateLimit, securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertRequestBodySize(request, 8 * 1024);
    const identity = await requireRequestIdentity(request);
    await enforceRateLimit({ request, bucket: "feed-reaction", limit: 240, windowSeconds: 3600, identityId: identity.id });
    const input = await request.json() as Record<string, unknown>;
    const postId = typeof input.postId === "string" ? input.postId : "";
    if (!postId) throw new Error("Post is required.");
    return Response.json({ liked: await toggleFeedReaction({ postId, userId: identity.id }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the reaction.";
    return Response.json({ error: message }, { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 400) });
  }
}
