import {
  GET as generationState,
  POST as generate,
} from "@/app/api/generate/route";
import {
  enforceMobileBetaAllowance,
  mobileError,
  requireMobileIdentity,
  requireOwnedCharacter,
} from "@/lib/server/mobile-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const characterId =
      new URL(request.url).searchParams.get("characterId")?.trim() ?? "";
    await requireOwnedCharacter(identity, characterId);
    return generationState(request);
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const input = (await request.json()) as Record<string, unknown>;
    const characterId =
      typeof input.characterId === "string" ? input.characterId.trim() : "";
    await requireOwnedCharacter(identity, characterId);
    await enforceMobileBetaAllowance(identity, characterId);
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return generate(forwarded);
  } catch (error) {
    return mobileError(error);
  }
}
