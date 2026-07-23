import { POST as writeMagic } from "@/app/api/write/magic/route";
import {
  mobileError,
  requireMobileIdentity,
  requireOwnedCharacter,
} from "@/lib/server/mobile-auth";
import { listCharacters } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const input = (await request.json()) as Record<string, unknown>;
    const characterId =
      typeof input.characterId === "string" ? input.characterId.trim() : "";
    await requireOwnedCharacter(identity, characterId);
    const character = (await listCharacters()).find(
      (candidate) => candidate.id === characterId,
    );
    if (!character) throw new Error("Actor not found.");
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "spark",
        durationSeconds: 5,
        brief:
          typeof input.brief === "string" ? input.brief.trim().slice(0, 4000) : "",
        characters: [character],
        castIds: [character.id],
      }),
    });
    return writeMagic(forwarded);
  } catch (error) {
    return mobileError(error);
  }
}
