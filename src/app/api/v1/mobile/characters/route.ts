import type {
  Archetype,
  Character,
  VoiceGender,
} from "@/lib/types";
import {
  mobileError,
  requireMobileIdentity,
} from "@/lib/server/mobile-auth";
import {
  listCharacters,
  persistCharacter,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const archetypes = new Set<Archetype>([
  "villain",
  "mentor",
  "love-interest",
  "comic-relief",
  "hero",
  "superhero",
  "horror",
  "rebel",
  "sidekick",
  "outsider",
]);
const voiceGenders = new Set<VoiceGender>([
  "feminine",
  "masculine",
  "androgynous",
]);

function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const characters = (await listCharacters()).filter(
      (character) => character.makerId === identity.id,
    );
    return Response.json({ characters });
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const input = (await request.json()) as Record<string, unknown>;
    const archetype = String(input.archetype || "hero") as Archetype;
    const voiceGender = String(
      input.voiceGender || "androgynous",
    ) as VoiceGender;
    if (!archetypes.has(archetype)) throw new Error("archetype is invalid.");
    if (!voiceGenders.has(voiceGender)) {
      throw new Error("voiceGender is invalid.");
    }
    const character: Character = {
      id: crypto.randomUUID(),
      makerId: identity.id,
      name: text(input.name, "name", 120),
      archetype,
      archetypeMix: [archetype],
      tagline: text(input.tagline, "tagline", 500),
      personality: text(input.personality, "personality", 2000),
      voiceGender,
      voiceDesc: text(input.voiceDescription, "voiceDescription", 4000),
      sfxDesc: text(input.signatureSfx, "signatureSfx", 2000),
      themeDesc: text(input.themeScore, "themeScore", 2000),
      productionBible:
        input.productionBible && typeof input.productionBible === "object"
          ? (input.productionBible as Character["productionBible"])
          : undefined,
      brollLine: "",
      brollScene: text(input.worldBrief || input.brief, "worldBrief", 1500),
      avatarHue: Math.floor(Math.random() * 360),
      licenseType: "approval",
      royaltyRate: 0,
      createdAt: new Date().toISOString(),
      stats: { castings: 0, fans: 0, earnings: 0 },
    };
    await persistCharacter(character);
    return Response.json({ character }, { status: 201 });
  } catch (error) {
    return mobileError(error);
  }
}
