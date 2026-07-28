import {
  selectCharacterProfileMedia,
  selectCharacterSceneImageAsset,
  type CharacterProfileSlot,
} from "@/lib/server/supabase-admin";
import { requireOwnedCharacter, requireRequestIdentity } from "@/lib/server/auth";
import {
  assertRequestBodySize,
  enforceRateLimit,
  securityErrorStatus,
} from "@/lib/server/request-security";

export const runtime = "nodejs";

const SLOTS = new Set<CharacterProfileSlot | "scene">(["voice", "theme", "video", "cover", "scene"]);

function requiredString(value: unknown, field: string, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  try {
    assertRequestBodySize(request, 32 * 1024);
    const identity = await requireRequestIdentity(request);
    const body = await request.json() as Record<string, unknown>;
    const characterId = requiredString(body.characterId, "characterId");
    await requireOwnedCharacter(identity, characterId);
    if (identity.role !== "admin") {
      await enforceRateLimit({
        request,
        bucket: "profile-media-selection",
        limit: 120,
        windowSeconds: 60 * 60,
        identityId: identity.id,
      });
    }
    const assetId = requiredString(body.assetId, "assetId");
    const slot = requiredString(body.slot, "slot", 20) as CharacterProfileSlot | "scene";
    if (!SLOTS.has(slot)) throw new Error("slot is invalid.");
    if (slot === "scene") return Response.json(await selectCharacterSceneImageAsset({ characterId, assetId }));
    return Response.json(await selectCharacterProfileMedia({ characterId, assetId, slot }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not select profile media." },
      { status: securityErrorStatus(error, error instanceof Error && error.message === "Sign in to continue." ? 401 : 400) }
    );
  }
}
