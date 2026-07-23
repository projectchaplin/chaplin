import {
  buildProductionBible,
  composeSfxPrompt,
  composeThemePrompt,
  composeVoiceDesignPrompt,
} from "@/lib/production-prompting";
import type { Archetype, CharacterProductionBible, VoiceGender } from "@/lib/types";
import { alignVoiceDescription, explicitVoiceGender } from "@/lib/character-coherence";
import { getPipelineConfig } from "@/lib/server/pipeline-config";

export const runtime = "nodejs";
export const maxDuration = 120; // json_schema output on this bible runs 35-55s; give real headroom over the wall clock

type CharacterSuggestion = {
  tagline: string;
  personality: string;
  voiceGender: VoiceGender;
  voiceDescription: string;
  signatureSfx: string;
  themeScore: string;
  productionBible: CharacterProductionBible;
};

const TARGETS = ["all", "tagline", "personality", "voice", "sfx", "theme"] as const;
type SuggestionTarget = typeof TARGETS[number];

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function enforceVoiceCoherence(suggestion: CharacterSuggestion, characterBrief: string) {
  const voiceGender = explicitVoiceGender(`${characterBrief} ${suggestion.personality}`) ?? suggestion.voiceGender;
  if (voiceGender === suggestion.voiceGender) return suggestion;
  return {
    ...suggestion,
    voiceGender,
    voiceDescription: alignVoiceDescription(suggestion.voiceDescription, voiceGender),
  };
}

function localSuggestion(input: {
  name: string;
  archetype: Archetype;
  archetypeMix?: Archetype[];
  characterBrief?: string;
  voiceGender: VoiceGender;
  tagline: string;
  personality: string;
  appearanceBrief?: string;
  worldBrief?: string;
}): CharacterSuggestion {
  const name = input.name || "This actor";
  const resolvedVoiceGender = explicitVoiceGender(`${input.characterBrief ?? ""} ${input.personality}`) ?? input.voiceGender;
  const identity: Record<string, { hook: string; want: string; edge: string; sound: string; score: string }> = {
    villain: { hook: "makes every threat sound like an invitation", want: "control the room before anyone notices the trap", edge: "polite until resistance becomes interesting", sound: "a signet ring tapping once against cut glass", score: "low sarangi tension over a restrained ticking pulse" },
    mentor: { hook: "has already survived the mistake you are about to make", want: "prepare others without stealing their choice", edge: "patient, observant, and unexpectedly severe when truth is avoided", sound: "prayer beads clicking around one measured breath", score: "warm santoor phrases over a deep, steady drone" },
    "love-interest": { hook: "steals secrets, never scenes", want: "be chosen without surrendering independence", edge: "magnetic, composed, and more dangerous when amused", sound: "a hidden latch releasing beneath soft room tone", score: "intimate ghazal strings with one unresolved sarangi phrase" },
    "comic-relief": { hook: "finds the joke one second before the danger", want: "prove the fool is often the only person paying attention", edge: "fast, warm, and fearless when everyone else freezes", sound: "a quick metallic fumble resolving into a perfect click", score: "playful dhol and brass with an unexpectedly heroic finish" },
    hero: { hook: "never throws the first punch, only the one that matters", want: "keep ordinary people safe without needing their applause", edge: "grounded, protective, dryly funny, and decisive under pressure", sound: "a taut glove pull followed by one controlled impact", score: "driving percussion beneath a rising brass-and-strings motif" },
    superhero: { hook: "arrives late enough to make an entrance and early enough to save everyone", want: "turn impossible power into practical help", edge: "bold, funny, compassionate, and privately afraid of failing in public", sound: "a rising energy charge resolving into one clean pulse", score: "uplifting orchestral rhythm with bright Indian percussion and a signature three-note ascent" },
    horror: { hook: "is always visible in the frame you forgot to check", want: "make the living acknowledge what the house remembers", edge: "quiet, ritualistic, and terrifyingly patient", sound: "a film reel slowing as an empty seat folds shut", score: "detuned harmonium, bowed metal, and a distant pulse that stops too early" },
    rebel: { hook: "breaks rules only after learning who they protect", want: "expose the bargain everyone else agreed not to mention", edge: "defiant, strategic, and loyal beneath the provocation", sound: "a match strike under a snapping banner in hard wind", score: "defiant nagada drums beneath a cutting electric-string motif" },
    sidekick: { hook: "keeps the plan alive after the hero ruins it", want: "be trusted with more than cleaning up someone else's legend", edge: "resourceful, loyal, candid, and quietly ambitious", sound: "tools clicking into place in one rapid sequence", score: "nimble hand percussion with a bright ascending woodwind hook" },
    outsider: { hook: "notices the rule because nobody explained it to them", want: "belong without becoming harmless", edge: "watchful, self-contained, and startlingly direct", sound: "a distant train brake followed by one approaching footstep", score: "sparse plucked strings over a widening atmospheric bass note" },
  };
  const profile = identity[input.archetype] ?? identity.hero;
  const secondary = (input.archetypeMix ?? [])
    .filter((a) => a !== input.archetype)
    .map((a) => identity[a])
    .filter(Boolean);
  const blendEdge = secondary.length
    ? ` Under the surface, ${name} also ${secondary[0].hook}.`
    : "";
  const briefLine = input.characterBrief ? ` ${input.characterBrief.trim().replace(/\.?$/, ".")}` : "";
  const suggestion = {
    tagline: input.tagline || `${name} ${profile.hook}.`,
    personality: input.personality || `${briefLine ? briefLine.trim() + " " : ""}${name} wants to ${profile.want}. ${name} is ${profile.edge}.${blendEdge} In conversation, ${name} listens for the detail everyone skips, answers with concise wit, and becomes completely still before making a difficult decision. The contradiction is the engine: confidence in action, vulnerability around the people who matter.`,
    voiceGender: resolvedVoiceGender,
    voiceDescription: `An original adult ${resolvedVoiceGender} voice: grounded Indian English, clear Hindi and Urdu pronunciation, confident mid-register resonance, conversational pacing, dry comic timing, and controlled authority that intensifies without shouting. Distinctive and repeatable; never an imitation of a real person.`,
    signatureSfx: `${profile.sound}; a distinctive five-second identity sting with clean foreground detail, subtle cinematic room tone, and no speech or music.`,
    themeScore: `${profile.score}; a memorable 12-second instrumental identity theme with a clear opening motif, controlled lift, and clean ending. No vocals.`,
  };
  const productionBible = buildProductionBible({
      name,
      archetype: input.archetype,
      tagline: suggestion.tagline,
      personality: suggestion.personality,
      voiceGender: resolvedVoiceGender,
      voiceDesc: suggestion.voiceDescription,
      sfxDesc: suggestion.signatureSfx,
      themeDesc: suggestion.themeScore,
      appearanceBrief: input.appearanceBrief,
      worldBrief: input.worldBrief,
  });
  const character = { ...input, name, ...suggestion, productionBible, voiceDesc: suggestion.voiceDescription, sfxDesc: suggestion.signatureSfx, themeDesc: suggestion.themeScore };
  return {
    ...suggestion,
    voiceDescription: composeVoiceDesignPrompt(character),
    signatureSfx: composeSfxPrompt(character),
    themeScore: composeThemePrompt(character),
    productionBible,
  };
}

const STRING = { type: "string" } as const;
const STRING_ARRAY = { type: "array", items: STRING } as const;
const PRODUCTION_BIBLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "dramatic", "performance", "visual", "cinematography", "story"],
  properties: {
    version: { type: "integer", enum: [1] },
    dramatic: {
      type: "object", additionalProperties: false,
      required: ["externalWant", "innerNeed", "contradiction", "stakes", "vulnerability", "moralBoundary"],
      properties: { externalWant: STRING, innerNeed: STRING, contradiction: STRING, stakes: STRING, vulnerability: STRING, moralBoundary: STRING },
    },
    performance: {
      type: "object", additionalProperties: false,
      required: ["restingExpression", "underPressure", "signatureGesture", "movementStyle", "eyeline", "tempo"],
      properties: { restingExpression: STRING, underPressure: STRING, signatureGesture: STRING, movementStyle: STRING, eyeline: STRING, tempo: STRING },
    },
    visual: {
      type: "object", additionalProperties: false,
      required: ["perceivedAge", "faceAnchors", "hair", "wardrobe", "silhouette", "palette", "continuityRules"],
      properties: { perceivedAge: STRING, faceAnchors: STRING_ARRAY, hair: STRING, wardrobe: STRING, silhouette: STRING, palette: STRING_ARRAY, continuityRules: STRING_ARRAY },
    },
    cinematography: {
      type: "object", additionalProperties: false,
      required: ["heroFraming", "cameraHeight", "lens", "keyLight", "fillLight", "edgeLight", "worldTexture"],
      properties: { heroFraming: STRING, cameraHeight: STRING, lens: STRING, keyLight: STRING, fillLight: STRING, edgeLight: STRING, worldTexture: STRING },
    },
    story: {
      type: "object", additionalProperties: false,
      required: ["hookPattern", "escalationPattern", "cliffhangerPattern", "payoffPattern", "recurringMotifs", "avoid"],
      properties: { hookPattern: STRING, escalationPattern: STRING, cliffhangerPattern: STRING, payoffPattern: STRING, recurringMotifs: STRING_ARRAY, avoid: STRING_ARRAY },
    },
  },
} as const;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tagline", "personality", "voiceGender", "voiceDescription", "signatureSfx", "themeScore", "productionBible"],
  properties: {
    tagline: { type: "string" },
    personality: { type: "string" },
    voiceGender: { type: "string", enum: ["feminine", "masculine", "androgynous"] },
    voiceDescription: { type: "string" },
    signatureSfx: { type: "string" },
    themeScore: { type: "string" },
    productionBible: PRODUCTION_BIBLE_SCHEMA,
  },
} as const;

export async function POST(request: Request) {
  let fallbackInput: Parameters<typeof localSuggestion>[0] | null = null;
  try {
    const body = await request.json() as Record<string, unknown>;
    const targetValue = clean(body.target, 30) as SuggestionTarget;
    const target = TARGETS.includes(targetValue) ? targetValue : "all";
    const name = clean(body.name, 120);
    if (!name) return Response.json({ error: "Name the AI actor first." }, { status: 400 });
    if (target === "all" && clean(body.characterBrief, 1500).length < 20) {
      return Response.json(
        { error: "Write at least a line or two about who this actor is — the brief drives the whole identity. (If you don't see the brief box, refresh the page.)" },
        { status: 400 }
      );
    }
    const archetypeMix = Array.isArray(body.archetypes)
      ? body.archetypes
          .filter((a): a is string => typeof a === "string")
          .map((a) => clean(a, 40) as Archetype)
          .slice(0, 5)
      : [];
    const characterBrief = clean(body.characterBrief, 1500);
    const requestedVoiceGender = clean(body.voiceGender, 30) as VoiceGender;
    const input = {
      name,
      archetype: (clean(body.archetype, 40) as Archetype) || archetypeMix[0],
      archetypeMix,
      characterBrief,
      voiceGender: explicitVoiceGender(characterBrief) ??
        (["feminine", "masculine", "androgynous"].includes(requestedVoiceGender) ? requestedVoiceGender : "androgynous"),
      tagline: clean(body.tagline, 500),
      personality: clean(body.personality, 2000),
      appearanceBrief: clean(body.appearanceBrief, 1200),
      worldBrief: clean(body.worldBrief, 1200),
    };
    fallbackInput = input;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ suggestion: localSuggestion(input), provider: "chaplin-local", configured: false });
    }

    const writingConfig = (await getPipelineConfig()).stages.writing;
    if (!writingConfig.enabled) throw new Error("AI writing is paused by Super Admin.");
    const model = writingConfig.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
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
        temperature: writingConfig.temperature ?? 0.65,
        thinking: { type: "disabled" },
        system: `${writingConfig.promptPrelude} You are Chaplin's casting director, performance director, cinematographer, and story editor. Build an original production-ready fictional actor, not a biography. Every value must be playable, visible, recordable, or usable as a continuity rule. The visual identity is the highest-priority output: infer a face, hair, body presence, signature wardrobe, material texture, palette, setting, camera, and motivated light that express the personality without reducing the actor to an archetype costume. perceivedAge must be an actual narrow visible age range. Each of the three faceAnchors must name concrete repeatable anatomy or surface detail—brow shape or spacing, eye shape or set, nose structure, mouth, jaw, skin texture, scar, mole, or asymmetry—not generic phrases such as 'distinct face' or 'preserve exactly.' Hair must specify length, texture, part or hairline, finish, and grooming. Wardrobe must specify exact garments, cut, materials, colors, wear, and no logos. Silhouette must describe visible proportions, stance, and one recognizable shape. Camera and lighting must be chosen to reveal those anchors and the central personality contradiction. If appearance or world direction is supplied, preserve it exactly; otherwise invent one coherent, culturally grounded, non-celebrity identity. Also create a dramatic want/need contradiction, precise pressure behavior and micro-expression, motivated story engine, visual hook, situation-changing cliffhanger, payoff, motifs, and explicit cliches to avoid. Never imitate a celebrity or copyrighted character. Voice coherence is mandatory: explicit pronouns and gender words in characterBrief override an unlocked UI default, and voiceGender plus voiceDescription must agree with each other. The voice prompt must follow ElevenLabs Voice Design order and contain no FX language. SFX must be a concise physical five-second one-shot. Theme must be a 12-second instrumental identity cue. Do not repeat biography across fields and do not use generic adjectives without observable evidence.`,
        messages: [{
          role: "user",
          content: JSON.stringify({
            target,
            instruction: target === "all" ? "Complete every character identity field." : `Refresh the ${target} while keeping the full identity coherent. Return every field, preserving the others where useful.`,
            archetypeGuidance: input.archetypeMix.length > 1
              ? `This actor blends multiple archetypes: ${input.archetypeMix.join(", ")}. The first is dominant; weave the others in as genuine contradictions, not costume changes.`
              : undefined,
            briefGuidance: input.characterBrief
              ? "characterBrief is the maker's creative direction. Treat it as binding canon: every field must be consistent with it."
              : undefined,
            currentCharacter: input,
          }),
        }],
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      }),
    });
    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };
    if (!response.ok) throw new Error(data.error?.message || `Claude returned ${response.status}.`);
    if (data.stop_reason === "max_tokens") throw new Error("The character ran longer than the output limit. Try again.");
    const output = data.content?.find((block) => block.type === "text")?.text;
    if (!output) throw new Error("Claude returned no character suggestion.");
    let parsed: CharacterSuggestion;
    try {
      parsed = JSON.parse(output) as CharacterSuggestion;
    } catch {
      throw new Error("Claude's output was cut off mid-write. Try again.");
    }
    return Response.json({
      suggestion: enforceVoiceCoherence(parsed, input.characterBrief),
      provider: "anthropic",
      model,
      usage: data.usage,
      configured: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character suggestion failed.";
    if (fallbackInput) {
      return Response.json({
        suggestion: localSuggestion(fallbackInput),
        provider: "chaplin-local",
        configured: Boolean(process.env.ANTHROPIC_API_KEY),
        warning: `Claude could not run: ${message} Local character suggestions were used instead.`,
      });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
