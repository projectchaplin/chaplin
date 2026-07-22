import {
  beginGeneration,
  completeGeneration,
  ensureCharacter,
  failGeneration,
  getCharacterProductionState,
} from "@/lib/server/supabase-admin";
import { calculateGenerationBilling } from "@/lib/server/billing";
import { anthropicImageBlock } from "@/lib/server/anthropic-image";
import {
  buildProductionBible,
  buildScenePackage,
  composeIdentityImagePrompt,
  composeSfxPrompt,
  composeThemePrompt,
  composeVoiceDesignPrompt,
} from "@/lib/production-prompting";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const FIELDS = [
  "voice-description",
  "voice-preview",
  "dialogue",
  "sfx",
  "theme",
  "identity-image",
  "image",
  "video",
] as const;
type QuickField = typeof FIELDS[number];
const VISUAL_FIELDS = new Set<QuickField>(["identity-image", "image", "video"]);

const FIELD_RULES: Record<QuickField, string> = {
  "voice-description": "Write only an ElevenLabs Voice Design prompt using this order: native language and dialect; gender presentation and age range; quality; 2-5 word persona; 2-3 emotions; timbre, pitch, resonance, pacing, intonation, and pressure behavior. Do not include biography, camera language, SFX, reverb, echo, phone, tape, or celebrity imitation. 65-105 words.",
  "voice-preview": "Write one or two short spoken lines that reveal the actor's distinctive personality and test pacing, emotion, pronunciation, and vocal range. It must sound natural when performed in 6-12 seconds. Output dialogue only.",
  dialogue: "Write a concise, performable line in this actor's established personality and locked voice. Preserve the user's intent, use subtext rather than exposition, and make it memorable without catchphrase clichés. Output dialogue only.",
  sfx: "Write only an ElevenLabs 1-2 second non-musical signature-sound prompt. Translate the actor's personality into one physical source, a precise material texture, a close acoustic distance, one unusual identifying detail, and a clean stop. It must work as a short repeatable sonic logo, not a sequence, biography, ambience bed, or score. No speech, voice, melody, riser, or trailer braam. 30-55 words.",
  theme: "Write only an Eleven Music prompt for a 12-second instrumental ident. Include BPM, key, a three-note motif, exact instruments, 0-3s / 3-8s / 8-12s development, mix priority, and final cadence. No biography, sound-effect sequence, vocals, choir, lyrics, or copyrighted imitation. 55-95 words.",
  "identity-image": "Write only a Seedream 16:9 Identity Hero prompt for the actor's definitive casting image. Use coherent natural-language blocks in this order: PURPOSE; ACTOR with specific repeatable face anchors; VISIBLE PERSONALITY translating want, contradiction, vulnerability, and pressure behavior into expression, hands, posture, weight, and eyeline; SIGNATURE LOOK with exact wardrobe materials and silhouette; one restrained WORLD detail; COMPOSITION with framing, camera height, angle, lens and negative space; physically motivated LIGHT with direction and temperature; LOCKS AND EXCLUSIONS. One person. The image must instantly explain why this actor is castable, not summarize biography or depict a generic archetype. No plot montage, fashion pose, generic hero stance, dialogue, text, logo, UI, or watermark. 220-360 words and under 600 words.",
  image: "Write only a Seedream 16:9 story first-frame prompt using coherent natural-language labeled blocks: SUBJECT identity anchors; PERFORMANCE LOGIC from the actor's personality; DRAMATIC MOMENT; SET; CAMERA framing, angle, height, and lens; LIGHTING with motivated key direction, fill, edge, and temperature; CONTINUITY locks; EXCLUSIONS. Show one playable decision through face, hands, weight, and eyeline. No biography, plot summary, camera movement, dialogue, typography, logo, or watermark. 180-300 words and under 600 words.",
  video: "Write only a Seedance five-second IMAGE-TO-VIDEO motion plan. State that the supplied image is exact first frame/source of truth; do not redescribe the actor, wardrobe, set, palette, or biography. Specify 0.0-1.2s, 1.2-3.5s, and 3.5-5.0s subject action; one facial beat; one camera path; fixed source-image axis/lens/horizon; light continuity; secondary motion; final frame; identity and geometry locks. Silent plate: no lip-sync, speech, subtitles, text, logo, or watermark. 130-220 words.",
};

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function localRewrite(field: QuickField, character: Character, currentText: string) {
  const base = currentText || character.tagline;
  const scene = buildScenePackage(character, Math.abs(base.length) % 4);
  if (field === "voice-description") return composeVoiceDesignPrompt(character);
  if (field === "voice-preview") return character.brollLine || scene.dialogue;
  if (field === "dialogue") return scene.dialogue;
  if (field === "sfx") return composeSfxPrompt(character);
  if (field === "theme") return composeThemePrompt(character);
  if (field === "identity-image") return composeIdentityImagePrompt(character);
  return field === "image" ? scene.image : scene.video;
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
    const production = VISUAL_FIELDS.has(field) ? await getCharacterProductionState(character.id) : null;
    const visualReference = production?.visualReference ?? null;
    const promptPayload = JSON.stringify({
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
        productionBible: character.productionBible ?? buildProductionBible(character),
        visualReference: visualReference ? { source: visualReference.source, assetId: visualReference.assetId } : null,
      },
      relatedCurrentFields: context,
    });
    const messageContent = visualReference
      ? [
          await anthropicImageBlock(visualReference.url),
          { type: "text" as const, text: `The image above is ${character.name}'s canonical visual identity seed. Base composition and continuity on what is actually visible. Do not invent a conflicting face, age, hair, body, wardrobe, palette, or material.` },
          { type: "text" as const, text: promptPayload },
        ]
      : promptPayload;
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
          content: messageContent,
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
      { field, characterId: character.id, visualReference: visualReference?.url ?? null, visualReferenceSource: visualReference?.source ?? null },
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
