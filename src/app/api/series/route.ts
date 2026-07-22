import { createSeries, listSeries } from "@/lib/server/series";
import type { NewSeriesInput, SeriesStoryEngine } from "@/lib/series-types";

export const runtime = "nodejs";

function text(value: unknown, field: string, max = 3000) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown, max = 3000) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function parseStoryEngine(value: unknown): SeriesStoryEngine {
  if (!value || typeof value !== "object") throw new Error("The story engine is required.");
  const engine = value as Record<string, unknown>;
  return {
    audiencePromise: text(engine.audiencePromise, "Audience promise"),
    centralConflict: text(engine.centralConflict, "Central conflict"),
    seasonQuestion: text(engine.seasonQuestion, "Season question"),
    escalationRule: text(engine.escalationRule, "Escalation rule"),
    cliffhangerRule: text(engine.cliffhangerRule, "Cliffhanger rule"),
    tone: text(engine.tone, "Tone"),
    brandBoundaries: Array.isArray(engine.brandBoundaries)
      ? engine.brandBoundaries.map((item) => optionalText(item, 300)).filter((item): item is string => Boolean(item)).slice(0, 12)
      : [],
  };
}

function parseInput(value: unknown): NewSeriesInput {
  if (!value || typeof value !== "object") throw new Error("Series data is required.");
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.cast) || input.cast.length < 1 || input.cast.length > 4) {
    throw new Error("Cast between one and four actors.");
  }
  if (!input.pilot || typeof input.pilot !== "object") throw new Error("A pilot episode is required.");
  const pilot = input.pilot as Record<string, unknown>;
  if (!Array.isArray(pilot.shots) || pilot.shots.length !== 12) {
    throw new Error("A 60-second pilot must contain exactly twelve five-second shots.");
  }
  return {
    ownerId: text(input.ownerId, "Owner", 120),
    title: text(input.title, "Series title", 160),
    logline: text(input.logline, "Series logline", 500),
    premise: text(input.premise, "Series premise", 3000),
    genre: text(input.genre, "Genre", 100),
    primaryLanguage: text(input.primaryLanguage, "Primary language", 100),
    secondaryLanguage: optionalText(input.secondaryLanguage, 100),
    storyEngine: parseStoryEngine(input.storyEngine),
    cast: input.cast.map((memberValue) => {
      if (!memberValue || typeof memberValue !== "object") throw new Error("Every cast member needs an actor and role.");
      const member = memberValue as Record<string, unknown>;
      return {
        characterId: text(member.characterId, "Actor", 160),
        roleName: text(member.roleName, "Role name", 160),
        continuityNotes: optionalText(member.continuityNotes),
      };
    }),
    pilot: {
      title: text(pilot.title, "Pilot title", 160),
      logline: text(pilot.logline, "Pilot logline", 500),
      openingHook: text(pilot.openingHook, "Opening hook", 1000),
      episodeObjective: text(pilot.episodeObjective, "Episode objective", 1000),
      cliffhanger: text(pilot.cliffhanger, "Cliffhanger", 1000),
      shots: pilot.shots.map((shotValue, index) => {
        if (!shotValue || typeof shotValue !== "object") throw new Error(`Shot ${index + 1} is incomplete.`);
        const shot = shotValue as Record<string, unknown>;
        return {
          beat: text(shot.beat, `Shot ${index + 1} beat`, 300),
          visualAction: text(shot.visualAction, `Shot ${index + 1} visual action`, 1000),
          cameraDirection: text(shot.cameraDirection, `Shot ${index + 1} camera`, 500),
          lightingDirection: text(shot.lightingDirection, `Shot ${index + 1} lighting`, 500),
          dialogue: optionalText(shot.dialogue, 500),
          audioDirection: optionalText(shot.audioDirection, 500),
        };
      }),
    },
  };
}

export async function GET() {
  try {
    return Response.json({ series: await listSeries() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load series." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const series = await createSeries(parseInput(await request.json()));
    return Response.json({ series }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the series.";
    const status = message.includes("required") || message.includes("must") || message.includes("Cast between") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}

