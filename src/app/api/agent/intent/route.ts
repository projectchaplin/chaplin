import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// The Concierge: turns one spoken/typed sentence into a structured creation
// intent, so the orb can prefill and launch the right builder with no boxes.

type ConciergeIntent = {
  intent: "create_character" | "create_video" | "create_ad" | "create_reel" | "create_series" | "browse" | "unclear";
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
    intent: { type: "string", enum: ["create_character", "create_video", "create_ad", "create_reel", "create_series", "browse", "unclear"] },
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

function localIntent(utterance: string): ConciergeIntent {
  const lower = utterance.toLowerCase();
  const wantsSeries = /series|episode|show|season|pilot/.test(lower);
  const wantsAd = /\bad\b|advert|campaign|commercial/.test(lower);
  const wantsReel = /reel|short|vertical/.test(lower);
  const wantsCharacter = /character|actor|persona|someone|guy|girl|woman|man|detective|hero|villain/.test(lower);
  const archetypes = ARCHETYPES.filter((a) => lower.includes(a.replace("-", " ")) || lower.includes(a));
  if (wantsSeries) return { intent: "create_series", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "A series it is. Opening the pilot builder." };
  if (wantsAd) return { intent: "create_ad", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "Let's make that ad. Opening the writing room." };
  if (wantsReel) return { intent: "create_reel", name: null, archetypes, characterBrief: null, storyBrief: utterance, reply: "One reel coming up. Opening the writing room." };
  if (wantsCharacter) return { intent: "create_character", name: null, archetypes: archetypes.length ? archetypes : ["hero"], characterBrief: utterance, storyBrief: null, reply: "I can see them already. Building your actor." };
  return { intent: "unclear", name: null, archetypes: [], characterBrief: null, storyBrief: null, reply: "Tell me a little more — a character you're imagining, or a story, ad, reel, or series you want made?" };
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
          system: `You are Chaplin's concierge — the first voice a creator hears. Chaplin is a casting marketplace for AI actors; users create original characters, then videos, ads, reels, and series starring them. Map the user's utterance to ONE intent. If they describe a person/personality, it's create_character: extract a name if they gave one (never invent one), pick 1-3 fitting archetypes from the allowed list, and rewrite their description into a vivid 1-3 sentence characterBrief in second person canon form. If they describe a story/video idea, choose create_video (or create_ad / create_reel / create_series when explicit) and distill storyBrief. "browse" only when they just want to look around. "unclear" when there is genuinely nothing to act on. reply is what you will SAY OUT LOUD next: one warm, confident sentence (max 18 words), no emoji, acknowledging what you're setting up. The user's role is ${role}.`,
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

  const fallback = localIntent(utterance);
  console.log(`[concierge] provider=local intent=${fallback.intent} utterance="${utterance.slice(0, 120)}"`);
  void logConcierge(utterance, fallback, "chaplin-local", "heuristic");
  return Response.json({ ...fallback, provider: "chaplin-local" });
}
