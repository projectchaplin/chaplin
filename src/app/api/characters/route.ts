import { ensureCharacter, persistCharacter } from "@/lib/server/supabase-admin";
import type { Archetype, Character, LicenseType, VoiceGender } from "@/lib/types";

export const runtime = "nodejs";

const ARCHETYPES = new Set<Archetype>([
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
const LICENSES = new Set<LicenseType>(["open", "paid", "approval"]);
const VOICE_GENDERS = new Set<VoiceGender>(["feminine", "masculine", "androgynous"]);

function requiredString(value: unknown, field: string, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function parseCharacter(value: unknown): Character {
  if (!value || typeof value !== "object") throw new Error("AI actor data is required.");
  const input = value as Record<string, unknown>;
  const archetype = requiredString(input.archetype, "archetype", 50) as Archetype;
  const voiceGender = requiredString(input.voiceGender, "voiceGender", 30) as VoiceGender;
  const licenseType = requiredString(input.licenseType, "licenseType", 30) as LicenseType;
  if (!ARCHETYPES.has(archetype)) throw new Error("archetype is invalid.");
  if (!VOICE_GENDERS.has(voiceGender)) throw new Error("voiceGender is invalid.");
  if (!LICENSES.has(licenseType)) throw new Error("licenseType is invalid.");

  const number = (field: string, fallback = 0) => {
    const candidate = Number(input[field] ?? fallback);
    if (!Number.isFinite(candidate)) throw new Error(`${field} is invalid.`);
    return candidate;
  };
  const stats = input.stats && typeof input.stats === "object" ? input.stats as Record<string, unknown> : {};

  return {
    id: requiredString(input.id, "id", 100),
    makerId: requiredString(input.makerId, "makerId", 100),
    name: requiredString(input.name, "name", 120),
    archetype,
    tagline: requiredString(input.tagline, "tagline", 500),
    personality: requiredString(input.personality, "personality", 2000),
    voiceGender,
    voiceDesc: requiredString(input.voiceDesc, "voiceDesc", 1000),
    voiceId: typeof input.voiceId === "string" ? input.voiceId : undefined,
    sfxDesc: requiredString(input.sfxDesc, "sfxDesc", 1000),
    themeDesc: requiredString(input.themeDesc, "themeDesc", 1000),
    brollLine: typeof input.brollLine === "string" ? input.brollLine : undefined,
    brollScene: typeof input.brollScene === "string" ? input.brollScene : undefined,
    avatarHue: number("avatarHue"),
    imageUrl: typeof input.imageUrl === "string" ? input.imageUrl : undefined,
    bannerUrl: typeof input.bannerUrl === "string" ? input.bannerUrl : undefined,
    videoUrl: typeof input.videoUrl === "string" ? input.videoUrl : undefined,
    galleryUrls: Array.isArray(input.galleryUrls) ? input.galleryUrls.filter((url): url is string => typeof url === "string") : undefined,
    licenseType,
    royaltyRate: number("royaltyRate"),
    createdAt: requiredString(input.createdAt, "createdAt", 100),
    stats: {
      castings: Number(stats.castings ?? 0),
      fans: Number(stats.fans ?? 0),
      earnings: Number(stats.earnings ?? 0),
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    const ensureOnly = Boolean(
      body && typeof body === "object" && (body as Record<string, unknown>).ensureOnly === true
    );
    const character = parseCharacter(
      ensureOnly ? (body as Record<string, unknown>).character : body
    );
    if (ensureOnly) {
      await ensureCharacter(character);
    } else {
      await persistCharacter(character);
    }
    return Response.json({ character });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save AI actor." },
      { status: 400 }
    );
  }
}
