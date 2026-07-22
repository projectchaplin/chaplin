import {
  selectCharacterProfileMedia,
  type CharacterProfileSlot,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const SLOTS = new Set<CharacterProfileSlot>(["voice", "theme", "video", "cover"]);

function requiredString(value: unknown, field: string, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const characterId = requiredString(body.characterId, "characterId");
    const assetId = requiredString(body.assetId, "assetId");
    const slot = requiredString(body.slot, "slot", 20) as CharacterProfileSlot;
    if (!SLOTS.has(slot)) throw new Error("slot is invalid.");
    return Response.json(await selectCharacterProfileMedia({ characterId, assetId, slot }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not select profile media." },
      { status: 400 }
    );
  }
}

