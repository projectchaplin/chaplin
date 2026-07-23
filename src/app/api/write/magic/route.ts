import { buildProductionBible } from "@/lib/production-prompting";
import { anthropicImageBlock, type AnthropicImageBlock } from "@/lib/server/anthropic-image";
import { getCharacterProductionState } from "@/lib/server/supabase-admin";
import { getPipelineConfig } from "@/lib/server/pipeline-config";
import type { Archetype, CharacterProductionBible, VoiceGender } from "@/lib/types";
import {
  normalizeProductionFormat,
  productionDuration,
  productionShotCount,
  type ProductionFormat,
} from "@/lib/production-formats";

export const runtime = "nodejs";
export const maxDuration = 120; // json_schema output on a full scene draft can run 35-55s; give real headroom over the wall clock

type PromptCharacter = {
  id: string;
  name: string;
  archetype: Archetype;
  tagline: string;
  personality: string;
  voiceGender: VoiceGender;
  voiceDesc: string;
  productionBible: CharacterProductionBible;
};

type MagicDraft = {
  title: string;
  logline: string;
  creativeDirection: string;
  castIds: string[];
  scenes: Array<{
    setting: string;
    objective: string;
    action: string;
    lines: Array<{ characterId: string; text: string }>;
  }>;
};

const FORMATS = new Set<ProductionFormat>(["spark", "punch", "episode", "spot"]);

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseCharacters(value: unknown): PromptCharacter[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const id = clean(row.id, 100);
    const name = clean(row.name, 120);
    if (!id || !name) return [];
    const base = {
      id,
      name,
      archetype: clean(row.archetype, 50) as Archetype,
      tagline: clean(row.tagline, 500),
      personality: clean(row.personality, 1200),
      voiceGender: clean(row.voiceGender, 30) as VoiceGender,
      voiceDesc: clean(row.voiceDesc, 700),
    };
    return [{
      ...base,
      productionBible: row.productionBible && typeof row.productionBible === "object"
        ? row.productionBible as CharacterProductionBible
        : buildProductionBible(base),
    }];
  });
}

function fallbackDraft(input: {
  format: ProductionFormat;
  durationSeconds: number;
  brief: string;
  title: string;
  logline: string;
  characters: PromptCharacter[];
  castIds: string[];
  productImageUrl?: string;
  productImageName?: string;
}): MagicDraft {
  const selected = input.castIds
    .map((id) => input.characters.find((character) => character.id === id))
    .filter((character): character is PromptCharacter => Boolean(character));
  const cast = (selected.length ? selected : input.characters.slice(0, input.format === "episode" ? 2 : 1)).slice(0, 4);
  const lead = cast[0];
  const foil = cast[1] ?? lead;
  const subject = input.brief || (input.format === "episode"
    ? `${lead?.name ?? "An unlikely hero"} must make one irreversible choice before dawn.`
    : `${lead?.name ?? "A charismatic AI actor"} introduces one memorable product benefit.`);
  const leadId = lead?.id ?? "";
  const foilId = foil?.id ?? leadId;
  const leadName = lead?.name ?? "The Lead";
  const foilName = foil?.name ?? leadName;
  const storyEngine = lead?.productionBible.story;

  if (input.format !== "episode") {
    const creatorShort = input.format === "spark" || input.format === "punch";
    const spark = input.format === "spark";
    return {
      title: input.title || (creatorShort ? `${leadName}: Casting Proof` : `${leadName} Makes the Case`),
      logline: input.logline || (creatorShort
        ? `${leadName} turns ${subject.toLowerCase()} into one unmistakable performance choice.`
        : `${leadName} turns ${subject.toLowerCase()} into one sharp, visual promise and a direct invitation to act.`),
      creativeDirection: `${input.durationSeconds}-second ${spark ? "private Spark audition" : input.format === "punch" ? "public Punch performance" : "managed brand Spot"}. ${input.productImageUrl ? `The uploaded ${input.productImageName || "product"} image is binding product canon and must remain visually exact.` : ""} Hook grammar: ${storyEngine?.hookPattern ?? "open on a visible interruption"}. ${creatorShort ? "Prove the actor's personality through visible pressure and choice." : "Communicate one benefit through proof on screen, then finish on a specific call to action."}`,
      castIds: cast.map((character) => character.id),
      scenes: [
        {
          setting: "EXT. CITY STREET - DAY",
          objective: `Hook attention in the first two seconds: ${storyEngine?.hookPattern ?? "show a visible problem or surprise"}.`,
          action: `${leadName} steps directly into frame as the ordinary world freezes behind them. A single prop reveals the problem without explanation.`,
          lines: [{ characterId: leadId, text: "Wait. You are still doing it the hard way?" }],
        },
        {
          setting: "INT. PRODUCT WORLD - CONTINUOUS",
          objective: "Demonstrate one concrete benefit rather than listing features.",
          action: `${leadName} makes one clean gesture. The environment transforms to show the before-and-after result in the same composition.`,
          lines: [{ characterId: leadId, text: "One move. Less friction. More of what you actually came for." }],
        },
        {
          setting: "INT. PROOF FRAME - CONTINUOUS",
          objective: "Make the promise believable through a visual result or reaction.",
          action: `${foilName} tests the result, looks back at ${leadName}, and gives the smallest possible impressed reaction.`,
          lines: foilId ? [{ characterId: foilId, text: "That was the whole process?" }] : [],
        },
        {
          setting: "EXT. CLEAN END FRAME - DAY",
          objective: `Pay off the actor's pattern (${storyEngine?.payoffPattern ?? "turn the demonstrated proof into a decision"}) and land a clear next action.`,
          action: `${leadName} faces camera. Product, result, and brand space resolve into one uncluttered final composition.`,
          lines: [{ characterId: leadId, text: creatorShort ? "You wanted proof. Keep watching." : "Make the next move. Start today." }],
        },
      ].filter((scene) => scene.lines.length > 0).slice(0, spark ? 1 : 4),
    };
  }

  return {
    title: input.title || `${leadName} and the Last Open Door`,
    logline: input.logline || `${leadName} pursues ${subject.toLowerCase()}, but ${foilName} forces a choice that changes what winning means.`,
    creativeDirection: `A compact three-act short built from the actor's persistent story engine. Hook: ${storyEngine?.hookPattern ?? "open after the obvious plan fails"}. Escalation: ${storyEngine?.escalationPattern ?? "make every gain create a cost"}. Cliffhanger: ${storyEngine?.cliffhangerPattern ?? "reverse the power relationship"}. Payoff: ${storyEngine?.payoffPattern ?? "resolve through a character choice"}. Every scene changes the situation; no biography as dialogue.`,
    castIds: cast.map((character) => character.id),
    scenes: [
      {
        setting: "INT. ABANDONED CINEMA LOBBY - NIGHT",
          objective: `Establish the external want (${lead?.productionBible.dramatic.externalWant ?? "a concrete urgent goal"}) through visible behavior and show why it must happen tonight.`,
        action: `${leadName} crosses the dark lobby, finds the projector key already missing, and sees fresh rainwater leading toward the auditorium.`,
        lines: [{ characterId: leadId, text: "Someone got here first. Good. I hate waiting for a story to begin." }],
      },
      {
        setting: "INT. CINEMA AUDITORIUM - MOMENTS LATER",
          objective: `Escalate through the actor's contradiction: ${lead?.productionBible.dramatic.contradiction ?? "the plan conflicts with a private value"}. End by changing who holds power.`,
        action: `${foilName} stands in the projector beam holding the key. The exit shutters slam down, turning negotiation into a deadline.`,
        lines: [
          { characterId: foilId, text: "You can keep the key, or you can get everyone out. Not both." },
          { characterId: leadId, text: "Then I was chasing the wrong thing." },
        ],
      },
      {
        setting: "EXT. CINEMA ROOFTOP - PRE-DAWN",
          objective: `Pay off the central choice through ${storyEngine?.payoffPattern ?? "an irreversible visual action"}, not an explanatory speech.`,
        action: `${leadName} uses the key to release the shutters, then lets it fall into the flooded street below. First light reaches the rooftop as the others emerge.`,
        lines: [{ characterId: leadId, text: "Doors are useful. Knowing when to leave them open is rarer." }],
      },
    ],
  };
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "creativeDirection", "castIds", "scenes"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    creativeDirection: { type: "string" },
    castIds: { type: "array", items: { type: "string" } },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["setting", "objective", "action", "lines"],
        properties: {
          setting: { type: "string" },
          objective: { type: "string" },
          action: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["characterId", "text"],
              properties: {
                characterId: { type: "string" },
                text: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
  });
}

export async function POST(request: Request) {
  let fallbackInput: Parameters<typeof fallbackDraft>[0] | null = null;
  try {
    const body = await request.json() as Record<string, unknown>;
    const requestedFormat = normalizeProductionFormat(clean(body.format, 20), "punch");
    const format = FORMATS.has(requestedFormat) ? requestedFormat : "punch";
    const durationSeconds = productionDuration(format, Number(body.durationSeconds));
    const characters = parseCharacters(body.characters);
    if (characters.length === 0) {
      return Response.json({ error: "At least one available AI actor is required." }, { status: 400 });
    }
    const validIds = new Set(characters.map((character) => character.id));
    const castIds = Array.isArray(body.castIds)
      ? body.castIds.filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, 6)
      : [];
    const input = {
      format,
      durationSeconds,
      sceneDurationSeconds: 4,
      requiredSceneCount: productionShotCount(format, durationSeconds),
      brief: clean(body.brief, 4000),
      title: clean(body.title, 200),
      logline: clean(body.logline, 700),
      characters,
      castIds,
      productImageUrl: clean(body.productImageUrl, 2000),
      productImageName: clean(body.productImageName, 180),
    };
    if (format === "spot" && !input.productImageUrl) {
      return Response.json({ error: "A product image is required before writing a brand Spot." }, { status: 400 });
    }
    fallbackInput = input;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ draft: fallbackDraft(input), provider: "chaplin-local", configured: false });
    }

    const writingConfig = (await getPipelineConfig()).stages.writing;
    if (!writingConfig.enabled) throw new Error("AI writing is paused by Super Admin.");
    const model = writingConfig.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    const characterContext = characters.map((character) => ({
      ...character,
      selected: castIds.includes(character.id),
    }));
    const selectedCharacters = (castIds.length
      ? castIds.map((id) => characters.find((character) => character.id === id)).filter((character): character is PromptCharacter => Boolean(character))
      : characters.slice(0, format === "episode" ? 2 : 1)
    ).slice(0, 6);
    const visualContexts = (await Promise.all(selectedCharacters.map(async (character) => {
      try {
        const production = await getCharacterProductionState(character.id);
        if (!production.visualReference) return null;
        return {
          character,
          reference: production.visualReference,
          block: await anthropicImageBlock(production.visualReference.url),
        };
      } catch {
        return null;
      }
    }))).filter((context): context is {
      character: PromptCharacter;
      reference: NonNullable<Awaited<ReturnType<typeof getCharacterProductionState>>["visualReference"]>;
      block: AnthropicImageBlock;
    } => Boolean(context));
    const taskPayload = JSON.stringify({
      task: "Expand the user's partial input into a complete, editable production draft. Preserve useful supplied title and logline text, but improve weak or incomplete fields.",
      format,
      durationSeconds,
      brief: input.brief || "Invent a strong concept suited to the selected cast.",
      existingTitle: input.title || null,
      existingLogline: input.logline || null,
      productReference: input.productImageUrl
        ? {
            name: input.productImageName || "Uploaded product",
            rule: "Preserve exact shape, packaging, colors, proportions, label placement, and materials.",
          }
        : null,
      characters: characterContext.map((character) => ({
        ...character,
        visualReference: visualContexts.find((context) => context.character.id === character.id)?.reference.source ?? null,
      })),
    });
    const messageContent: Array<AnthropicImageBlock | { type: "text"; text: string }> = [];
    if (input.productImageUrl) {
      messageContent.push({
        type: "text",
        text: `Binding product reference for this brand Spot (${input.productImageName || "uploaded product"}):`,
      });
      messageContent.push(await anthropicImageBlock(input.productImageUrl));
    }
    for (const context of visualContexts) {
      messageContent.push({ type: "text", text: `Canonical visual identity seed for ${context.character.name}:` });
      messageContent.push(context.block);
    }
    messageContent.push({ type: "text", text: taskPayload });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.max(4000, writingConfig.maxTokens ?? 8000),
        thinking: { type: "disabled" },
        system: `${writingConfig.promptPrelude} You are Chaplin's senior screenwriter and advertising creative director. Write concise, production-ready scripts for fictional AI actors using each supplied production bible and canonical reference image as binding character canon. The images are the source of truth for face, apparent age, hair, body, wardrobe, materials, palette, and physical presence; stage action, blocking, framing, and motivated light around what is actually visible instead of redesigning or generically redescribing it. For a Spot, the supplied product image is equally binding canon: preserve its exact shape, packaging, proportions, colors, materials, label placement, and recognizable details; build the idea around what is actually visible instead of inventing or redesigning the product. Never restate biography as dialogue. Every returned scene is exactly one four-second visual unit and must have a screenplay slugline, one playable objective, one concise visible action that can complete in four seconds, and dialogue short enough to perform inside that same four-second window. Return exactly the requiredSceneCount supplied in the task. The first scene needs a visual hook, not an explanation. Each subsequent scene must escalate cost or reverse power. A cliffhanger must introduce new pressure, reveal consequential information, or force an irreversible choice; merely withholding information is not a cliffhanger. Payoffs must answer an earlier image, gesture, object, or moral boundary. Preserve performance tells, movement grammar, recurring motifs, and moral boundaries without mechanically repeating them. Spark is a private five-second audition with one performance choice. Punch is a public fifteen-second personality proof assembled from four authored four-second scenes and trimmed to runtime. Episode is a sixty-second microdrama ending on a situation-changing cliffhanger. Spot is a managed thirty- or sixty-second brand output that dramatizes one benefit through visible proof and a specific CTA. Keep scenes realistic for the requested duration and use only supplied character IDs.`,
        messages: [{
          role: "user",
          content: messageContent,
        }],
        output_config: {
          format: {
            type: "json_schema",
            schema: OUTPUT_SCHEMA,
          },
        },
      }),
    });
    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (!response.ok) {
      throw new Error(data.error?.message || `Claude returned ${response.status}.`);
    }
    const text = data.content?.find((block) => block.type === "text")?.text;
    if (!text) throw new Error("Claude returned no script draft.");
    const draft = JSON.parse(text) as MagicDraft;
    const allowedIds = new Set(characters.map((character) => character.id));
    const returnedScenes = Array.isArray(draft.scenes) ? draft.scenes : [];
    draft.scenes = returnedScenes.slice(0, 10).flatMap((scene) => {
      if (!scene || typeof scene !== "object") return [];
      const setting = clean(scene.setting, 300);
      const objective = clean(scene.objective, 700);
      const action = clean(scene.action, 1600);
      const lines = Array.isArray(scene.lines)
        ? scene.lines
          .filter((line) => line && allowedIds.has(line.characterId) && clean(line.text, 800))
          .slice(0, 12)
          .map((line) => ({ characterId: line.characterId, text: clean(line.text, 800) }))
        : [];
      return setting || objective || action || lines.length
        ? [{ setting, objective, action, lines }]
        : [];
    });
    const repairedEmptyScenes = draft.scenes.length === 0;
    if (repairedEmptyScenes) {
      draft.scenes = fallbackDraft(input).scenes;
    }
    const requiredSceneCount = productionShotCount(format, durationSeconds);
    if (format !== "spark") {
      const fallbackScenes = fallbackDraft(input).scenes;
      while (draft.scenes.length < requiredSceneCount && fallbackScenes.length) {
        const source = fallbackScenes[draft.scenes.length % fallbackScenes.length];
        draft.scenes.push({
          ...source,
          setting: source.setting.replace(/ - (DAY|NIGHT|CONTINUOUS)$/i, ` - CONTINUOUS ${draft.scenes.length + 1}`),
          lines: source.lines.map((line) => ({ ...line })),
        });
      }
      draft.scenes = draft.scenes.slice(0, requiredSceneCount);
    }
    const speakingCastIds = draft.scenes.flatMap((scene) => scene.lines.map((line) => line.characterId));
    draft.castIds = [...new Set([...draft.castIds, ...speakingCastIds])]
      .filter((id) => allowedIds.has(id));
    return Response.json({
      draft,
      provider: repairedEmptyScenes ? "chaplin-local" : "anthropic",
      model,
      usage: data.usage,
      configured: true,
      warning: repairedEmptyScenes
        ? "Claude returned no playable scene, so Chaplin repaired the draft with a complete local scene beat."
        : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build the magic draft.";
    if (fallbackInput) {
      return Response.json({
        draft: fallbackDraft(fallbackInput),
        provider: "chaplin-local",
        configured: Boolean(process.env.ANTHROPIC_API_KEY),
        warning: `Claude could not run: ${message} A complete local draft was used instead.`,
      });
    }
    return Response.json(
      { error: message },
      { status: 502 }
    );
  }
}
