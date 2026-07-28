import { NextRequest, NextResponse } from "next/server";
import { VideoBriefInputSchema } from "@/lib/video-brief";
import { requireRequestIdentity } from "@/lib/server/auth";
import { createVideoBrief } from "@/lib/server/video-briefs";
import { assertRequestBodySize, enforceRateLimit, securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertRequestBodySize(request, 256 * 1024);
    const identity = await requireRequestIdentity(request);
    await enforceRateLimit({ request, bucket: "video-brief-create", limit: 12, windowSeconds: 86400, identityId: identity.id });
    const brief = VideoBriefInputSchema.parse(await request.json());
    return NextResponse.json({ brief: await createVideoBrief(brief, identity.id) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create video brief.";
    return NextResponse.json(
      { error: message },
      { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : /required|cannot|must|invalid/i.test(message) ? 400 : 500) },
    );
  }
}
