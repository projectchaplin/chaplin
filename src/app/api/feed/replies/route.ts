import { NextRequest } from "next/server";
import { createFeedReply } from "@/lib/server/feed";
import { requireRequestIdentity } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const input = await request.json() as Record<string, unknown>;
    const postId = typeof input.postId === "string" ? input.postId : "";
    const body = typeof input.body === "string" ? input.body.trim().slice(0, 1000) : "";
    const parentReplyId = typeof input.parentReplyId === "string" ? input.parentReplyId : undefined;
    if (!postId || !body) throw new Error("Post and reply are required.");
    return Response.json({ id: await createFeedReply({ postId, authorId: identity.id, body, parentReplyId }) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish the reply.";
    return Response.json({ error: message }, { status: message === "Sign in to continue." ? 401 : 400 });
  }
}
