import {
  beginGeneration,
  completeGeneration,
  ensureCharacter,
  failGeneration,
} from "@/lib/server/supabase-admin";
import { calculateGenerationBilling } from "@/lib/server/billing";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const FIELDS = [
  "voice-description",
  "voice-preview",
  "dialogue",
  "sfx",
  "theme",
  "image",
  "video",
] as const;
type QuickField = typeof FIELDS[number];

const FIELD_RULES: Record<QuickField, string> = {
  "voice-description": "Write a precise ElevenLabs Voice Design description. Specify adult vocal identity, perceived age, accent and language behavior, timbre, resonance, pace, energy, emotional control, and repeatable performance qualities. Make it an original fictional voice and never imitate a real person. 70-130 words.",
  "voice-preview": "Write one or two short spoken lines that reveal the actor's distinctive personality and test pacing, emotion, pronunciation, and vocal range. It must sound natural when performed in 6-12 seconds. Output dialogue only.",
  dialogue: "Write a concise, performable line in this actor's established personality and locked voice. Preserve the user's intent, use subtext rather than exposition, and make it memorable without catchphrase clichés. Output dialogue only.",
  sfx: "Write a production prompt for one distinctive five-second signature sound effect. Describe foreground events, timing, texture, and subtle room tone. No speech, music, vocals, or character names spoken aloud. 25-60 words.",
  theme: "Write a production prompt for a distinctive 12-second instrumental character theme. Specify instrumentation, rhythm, emotional arc, memorable motif, mix, and clean ending. No vocals or copyrighted musical imitation. 35-80 words.",
  image: "Write a Seedream-ready cinematic 16:9 still prompt. Preserve the actor's exact face, age, wardrobe language, and identity; specify visible action, setting, composition, lens feeling, practical lighting, skin and fabric realism, and film texture. No text, logo, or watermark. 90-160 words.",
  video: "Write a Seedance-ready five-second image-to-video performance prompt. Preserve identity from the reference still; specify one clear physical action, facial beat, camera movement, environmental motion, timing, and final frame. This is a silent dubbing plate: no generated speech, vocals, subtitles, text, logo, or watermark. 90-170 words.",
};

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function localRewrite(field: QuickField, character: Character, currentText: string) {
  const base = currentText || character.tagline;
  if (field === "voice-description") return `An original adult ${character.voiceGender} voice with ${character.voiceDesc.toLowerCase()}. The performance is unmistakably ${character.name}: ${character.personality.toLowerCase()}. Natural Indian English with confident Hindi and Urdu pronunciation, controlled breath, clean consonants, and repeatable emotional timing. Never an imitation of a real person.`;
  if (field === "voice-preview") return character.brollLine || `${base.replace(/[.!?]+$/, "")}. You can doubt me after we are safely outside.`;
  if (field === "dialogue") return `${base.replace(/[.!?]+$/, "")}. Now watch what happens next.`;
  if (field === "sfx") return `${character.sfxDesc}. A five-second signature: immediate foreground detail, one sharp turning beat at three seconds, subtle cinematic room tone, then a clean stop. No speech or music.`;
  if (field === "theme") return `${character.themeDesc}. A 12-second instrumental identity theme for ${character.name}: establish one memorable motif, build controlled momentum, add a decisive final accent, and end cleanly. No vocals.`;
  if (field === "image") return `${character.name}, an original fictional ${character.archetype}, in a cinematic 16:9 production still. ${character.personality} ${base}. Preserve the same face, age, and wardrobe language. Medium-wide composition, practical motivated lighting, realistic skin and fabric, restrained film grain, strong depth, no text, logo, or watermark.`;
  return `${character.name} performs a five-second cinematic beat based on: ${base}. Preserve the exact identity, face, age, wardrobe, and setting from the reference image. One readable gesture, a subtle facial turn, controlled camera push-in, natural fabric and environmental motion, and a strong final look. Silent dubbing plate only: no speech, vocals, subtitles, text, logo, or watermark.`;
}

export async function POST(request: Request) {
  let jobId: string | null = null;
  let fallbackField: QuickField | null = null;
  let fallbackCharacter: Character | null = null;
  let fallbackCurrentText = "";
  try {
    const body = await request.json() as Record<string, unknown>;
    const field = clean(body.field, 40) as QuickField;
    if (!FIELDS.includes(field)) {
      return Response.json({ error: "Unknown Quick Write field." }, { status: 400 });
    }
    if (!body.character || typeof body.character !== "object") {
      return Response.json({ error: "AI actor context is required." }, { status: 400 });
    }
    const character = body.character as Character;
    if (!clean(character.id, 100) || !clean(character.name, 120)) {
      return Response.json({ error: "AI actor context is invalid." }, { status: 400 });
    }
    const currentText = clean(body.currentText);
    fallbackField = field;
    fallbackCharacter = character;
    fallbackCurrentText = currentText;
    const context = body.context && typeof body.context === "object"
      ? body.context as Record<string, unknown>
      : {};

    await ensureCharacter(character);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({
        text: localRewrite(field, character, currentText),
        provider: "chaplin-local",
        configured: false,
      });
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    jobId = await beginGeneration({
      characterId: character.id,
      kind: `prompt-${field}`,
      provider: "anthropic",
      model,
      prompt: currentText || `${field} for ${character.name}`,
    });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: `You are Chaplin's production copywriter. Rewrite exactly one field for an original fictional AI actor. Preserve useful user intent, character continuity, and provider constraints. Return only the requested field in structured JSON. ${FIELD_RULES[field]}`,
        messages: [{
          role: "user",
          content: JSON.stringify({
            field,
            currentText: currentText || null,
            actor: {
              name: character.name,
              archetype: character.archetype,
              tagline: character.tagline,
              personality: character.personality,
              voiceGender: character.voiceGender,
              voiceDescription: character.voiceDesc,
              signatureSfx: character.sfxDesc,
              theme: character.themeDesc,
              brollLine: character.brollLine ?? null,
              brollScene: character.brollScene ?? null,
            },
            relatedCurrentFields: context,
          }),
        }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["text"],
              properties: { text: { type: "string" } },
            },
          },
        },
      }),
    });
    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (!response.ok) throw new Error(data.error?.message || `Claude returned ${response.status}.`);
    const output = data.content?.find((block) => block.type === "text")?.text;
    if (!output) throw new Error("Claude returned no Quick Write result.");
    const result = JSON.parse(output) as { text?: unknown };
    const text = clean(result.text);
    if (!text) throw new Error("Claude returned an empty Quick Write result.");
    const usage = {
      inputTokens: Number(data.usage?.input_tokens ?? 0),
      outputTokens: Number(data.usage?.output_tokens ?? 0),
      providerTokens: Number(data.usage?.input_tokens ?? 0) + Number(data.usage?.output_tokens ?? 0),
      providerUsage: data.usage ?? {},
    };
    await completeGeneration(
      jobId,
      undefined,
      { field, characterId: character.id },
      await calculateGenerationBilling({ kind: "anthropic-prompt", usage })
    );
    return Response.json({ text, provider: "anthropic", model, usage, configured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quick Write failed.";
    if (jobId) await failGeneration(jobId, message);
    if (fallbackField && fallbackCharacter) {
      return Response.json({
        text: localRewrite(fallbackField, fallbackCharacter, fallbackCurrentText),
        provider: "chaplin-local",
        configured: Boolean(process.env.ANTHROPIC_API_KEY),
        warning: `Claude could not run: ${message} Local Quick Write was used instead.`,
      });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
