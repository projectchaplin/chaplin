import { buildProductionBible } from "@/lib/production-prompting";
import type { Archetype, CharacterProductionBible, VoiceGender } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type WritingFormat = "story" | "ad" | "reel";

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

const FORMATS = new Set<WritingFormat>(["story", "ad", "reel"]);

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
  format: WritingFormat;
  durationSeconds: number;
  brief: string;
  title: string;
  logline: string;
  characters: PromptCharacter[];
  castIds: string[];
}): MagicDraft {
  const selected = input.castIds
    .map((id) => input.characters.find((character) => character.id === id))
    .filter((character): character is PromptCharacter => Boolean(character));
  const cast = (selected.length ? selected : input.characters.slice(0, input.format === "story" ? 2 : 1)).slice(0, 4);
  const lead = cast[0];
  const foil = cast[1] ?? lead;
  const subject = input.brief || (input.format === "story"
    ? `${lead?.name ?? "An unlikely hero"} must make one irreversible choice before dawn.`
    : `${lead?.name ?? "A charismatic AI actor"} introduces one memorable product benefit.`);
  const leadId = lead?.id ?? "";
  const foilId = foil?.id ?? leadId;
  const leadName = lead?.name ?? "The Lead";
  const foilName = foil?.name ?? leadName;
  const storyEngine = lead?.productionBible.story;

  if (input.format === "ad" || input.format === "reel") {
    const reel = input.format === "reel";
    return {
      title: input.title || (reel ? `${leadName}: Stop the Scroll` : `${leadName} Makes the Case`),
      logline: input.logline || `${leadName} turns ${subject.toLowerCase()} into one sharp, visual promise and a direct invitation to act.`,
      creativeDirection: `${input.durationSeconds}-second ${reel ? "vertical reel" : "cinematic ad"}. Hook grammar: ${storyEngine?.hookPattern ?? "open on a visible interruption"}. Communicate one benefit through proof on screen, then finish on a specific call to action.`,
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
          lines: [{ characterId: leadId, text: reel ? "Try it once. Then tell me you want to go back." : "Make the next move. Start today." }],
        },
      ].filter((scene) => scene.lines.length > 0),
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
    const requestedFormat = clean(body.format, 20) as WritingFormat;
    const format = FORMATS.has(requestedFormat) ? requestedFormat : "story";
    const durationSeconds = Math.min(180, Math.max(5, Number(body.durationSeconds) || (format === "story" ? 60 : 15)));
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
      brief: clean(body.brief, 4000),
      title: clean(body.title, 200),
      logline: clean(body.logline, 700),
      characters,
      castIds,
    };
    fallbackInput = input;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ draft: fallbackDraft(input), provider: "chaplin-local", configured: false });
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    const characterContext = characters.map((character) => ({
      ...character,
      selected: castIds.includes(character.id),
    }));
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: `You are Chaplin's senior screenwriter and advertising creative director. Write concise, production-ready scripts for fictional AI actors using each supplied production bible as binding character canon. Never restate biography as dialogue. Every scene must have a screenplay slugline, one playable objective, visible blocking, conflict, a situation-changing turn, and dialogue driven by subtext. The first scene needs a visual hook, not an explanation. Each subsequent scene must escalate cost or reverse power. A cliffhanger must introduce new pressure, reveal consequential information, or force an irreversible choice; merely withholding information is not a cliffhanger. Payoffs must answer an earlier image, gesture, object, or moral boundary. Preserve performance tells, movement grammar, recurring motifs, and moral boundaries without mechanically repeating them. For ads and reels, dramatize one benefit through visible proof and finish with a specific CTA. Keep scenes realistic for the requested duration and use only supplied character IDs.`,
        messages: [{
          role: "user",
          content: JSON.stringify({
            task: "Expand the user's partial input into a complete, editable production draft. Preserve useful supplied title and logline text, but improve weak or incomplete fields.",
            format,
            durationSeconds,
            brief: input.brief || "Invent a strong concept suited to the selected cast.",
            existingTitle: input.title || null,
            existingLogline: input.logline || null,
            characters: characterContext,
          }),
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
    draft.scenes = draft.scenes.slice(0, 10).map((scene) => ({
      ...scene,
      lines: scene.lines.filter((line) => allowedIds.has(line.characterId)).slice(0, 12),
    })).filter((scene) => scene.lines.length > 0);
    const speakingCastIds = draft.scenes.flatMap((scene) => scene.lines.map((line) => line.characterId));
    draft.castIds = [...new Set([...draft.castIds, ...speakingCastIds])]
      .filter((id) => allowedIds.has(id));
    return Response.json({ draft, provider: "anthropic", model, usage: data.usage, configured: true });
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
