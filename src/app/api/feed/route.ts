import { NextRequest } from "next/server";
import { createFeedPost, listFeedPosts } from "@/lib/server/feed";
import { requireRequestIdentity } from "@/lib/server/auth";
import type { FeedMediaKind } from "@/lib/feed-types";
import { assertRequestBodySize, enforceRateLimit, securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function mediaUrl(value: unknown) {
  const url = clean(value, 2000);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  const configuredStorageHost = process.env.SUPABASE_URL
    ? new URL(process.env.SUPABASE_URL).hostname
    : "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === configuredStorageHost) return parsed.toString();
  } catch {
    // Fall through to the public validation error.
  }
  throw new Error("Media must come from Chaplin's configured storage.");
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const posts = await listFeedPosts({ viewerId: params.get("viewerId") ?? undefined, postId: params.get("postId") ?? undefined });
    return Response.json({ posts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the feed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRequestBodySize(request, 32 * 1024);
    const identity = await requireRequestIdentity(request);
    await enforceRateLimit({ request, bucket: "feed-post", limit: 10, windowSeconds: 3600, identityId: identity.id });
    const body = await request.json() as Record<string, unknown>;
    const postBody = clean(body.body, 2000);
    const url = mediaUrl(body.mediaUrl);
    const kind = body.mediaKind === "image" || body.mediaKind === "video"
      ? body.mediaKind as FeedMediaKind
      : undefined;
    const sharedPostId = clean(body.sharedPostId, 80) || undefined;
    if (!postBody && !url && !sharedPostId) throw new Error("Write something or attach one image or video.");
    if (Boolean(url) !== Boolean(kind)) throw new Error("Attach one image or video. Theme and Punch audio publish from their finished generation.");
    const id = await createFeedPost({ authorId: identity.id, body: postBody, mediaKind: kind, mediaUrl: url || undefined, sharedPostId });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish the post.";
    return Response.json({ error: message }, { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 400) });
  }
}
