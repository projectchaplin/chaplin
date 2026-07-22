import { NextRequest } from "next/server";
import { toggleFeedReaction } from "@/lib/server/feed";
import { requireRequestIdentity } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const input = await request.json() as Record<string, unknown>;
    const postId = typeof input.postId === "string" ? input.postId : "";
    if (!postId) throw new Error("Post is required.");
    return Response.json({ liked: await toggleFeedReaction({ postId, userId: identity.id }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the reaction.";
    return Response.json({ error: message }, { status: message === "Sign in to continue." ? 401 : 400 });
  }
}
