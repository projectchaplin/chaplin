import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// The Concierge turns one spoken or typed sentence into a structured creation
// intent, so it can launch the exact production contract before prompting.

type ConciergeIntent = {
  intent: "create_character" | "create_spark" | "create_punch" | "create_episode" | "create_spot" | "create_series" | "browse" | "unclear";
  name: string | null;
  archetypes: string[];
  characterBrief: string | null;
  storyBrief: string | null;
  reply: string;
};

const ARCHETYPES = ["villain", "mentor", "love-interest", "comic-relief", "hero", "superhero", "horror", "rebel", "sidekick", "outsider"];

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "name", "archetypes", "characterBrief", "storyBrief", "reply"],
  properties: {
    intent: { type: "string", enum: ["create_character", "create_spark", "create_punch", "create_episode", "create_spot", "create_series", "browse", "unclear"] },
    name: { type: ["string", "null"] },
    archetypes: { type: "array", items: { type: "string", enum: ARCHETYPES } },
    characterBrief: { type: ["string", "null"] },
    storyBrief: { type: ["string", "null"] },
    reply: { type: "string" },
  },
} as const;

function clean(value: unknown, max = 1500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function localIntent(utterance: string, role: string): ConciergeIntent {
  const lower = utterance.toLowerCase();
  const wantsSpark = /\bspark\b|5[\s-]?(?:second|seconds|sec)\b/.test(lower);
  const wantsPunch = /\bpunch\b|15[\s-]?(?:second|seconds|sec)\b|reel|short|vertical/.test(lower);
  const wantsEpisode = /\bepisode\b|micro[\s-]?drama|short drama|60[\s-]?(?:second|seconds|sec).*drama/.test(lower);
  const wantsSeries = /series|show|season|pilot/.test(lower);
  const wantsSpot = /\bspot\b|\bad\b|advert|campaign|commercial/.test(lower);
  const wantsCharacter = /character|actor|persona|someone|guy|girl|woman|man|detective|hero|villain/.test(lower);
  const archetypes = ARCHETYPES.filter((archetype) => lower.includes(archetype.replace("-", " ")) || lower.includes(archetype));

  if (wantsSpark) {
    return { intent: "create_spark", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "A five-second Spark. Opening its one-shot production." };
  }
  if (wantsPunch) {
    return { intent: "create_punch", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "A fifteen-second Punch. Opening its three-shot production." };
  }
  if (wantsEpisode) {
    return { intent: "create_episode", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "A sixty-second Episode. Opening its twelve-shot production." };
  }
  if (wantsSeries) {
    return { intent: "create_series", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "A series it is. Opening the pilot builder." };
  }
  if (wantsSpot || role === "brand") {
    return { intent: "create_spot", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "A Brand Spot. Opening the thirty or sixty-second production." };
  }
  if (wantsCharacter) {
    return { intent: "create_character", name: null, archetypes: archetypes.length ? archetypes : ["hero"], characterBrief: utterance, storyBrief: null, reply: "I can see them already. Building your actor." };
  }
  return {
    intent: "unclear",
    name: null,
    archetypes: [],
    characterBrief: null,
    storyBrief: null,
    reply: "Choose a character, Spark, Punch, Episode, or Brand Spot, then tell me the idea.",
  };
}

async function logConcierge(utterance: string, result: ConciergeIntent, provider: string, model: string) {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("generation_jobs").insert({
      character_id: null,
      kind: "concierge",
      provider,
      model,
      prompt: utterance,
      status: "succeeded",
      metadata: { intent: result.intent, name: result.name, archetypes: result.archetypes },
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[concierge] log skipped:", error instanceof Error ? error.message : error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const utterance = clean(body.utterance);
  const role = clean(body.role, 20) || "creator";
  if (utterance.length < 3) {
    return Response.json({ error: "Say or type what you want to make." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  if (apiKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          thinking: { type: "disabled" },
          system: `You are Chaplin's concierge, the first voice a creator hears. Map the request to one exact creation intent. Creator outputs are create_character, create_spark (exactly 5 seconds and 1 shot), create_punch (exactly 15 seconds and 3 shots), and create_episode (exactly 60 seconds and 12 shots). Brand output is create_spot (30 or 60 seconds, 6 or 12 shots). Super admins may access every output. If the user describes a person or personality, use create_character: extract a supplied name, never invent one, pick 1-3 allowed archetypes, and make a vivid 1-3 sentence characterBrief. If they describe an output idea, distill storyBrief and select the matching exact output. Use create_series only for a multi-episode series, show, season, or pilot. Use browse only when they want to explore, and unclear only when nothing is actionable. reply must be one warm sentence under 18 words and must state the selected duration when creating video. The user's role is ${role}.`,
          messages: [{ role: "user", content: utterance }],
          output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        }),
      });
      const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string }; stop_reason?: string };
      if (!response.ok) throw new Error(data.error?.message || `Claude returned ${response.status}.`);
      const text = data.content?.find((block) => block.type === "text")?.text;
      if (!text) throw new Error("Claude returned no intent.");
      const parsed = JSON.parse(text) as ConciergeIntent;
      console.log(`[concierge] provider=anthropic intent=${parsed.intent} name=${parsed.name ?? "-"} utterance="${utterance.slice(0, 120)}"`);
      void logConcierge(utterance, parsed, "anthropic", model);
      return Response.json({ ...parsed, provider: "anthropic" });
    } catch (error) {
      console.warn("[concierge] Claude failed, using local intent:", error instanceof Error ? error.message : error);
    }
  }

  const fallback = localIntent(utterance, role);
  console.log(`[concierge] provider=local intent=${fallback.intent} utterance="${utterance.slice(0, 120)}"`);
  void logConcierge(utterance, fallback, "chaplin-local", "heuristic");
  return Response.json({ ...fallback, provider: "chaplin-local" });
}
