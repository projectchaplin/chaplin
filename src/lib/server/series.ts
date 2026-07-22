import "server-only";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import type {
  EpisodeDetail,
  EpisodeShot,
  NewSeriesInput,
  SeriesDetail,
  SeriesStoryEngine,
  SeriesSummary,
} from "@/lib/series-types";

function fail(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function storyEngine(value: unknown): SeriesStoryEngine {
  const engine = (value ?? {}) as Partial<SeriesStoryEngine>;
  return {
    audiencePromise: engine.audiencePromise ?? "",
    centralConflict: engine.centralConflict ?? "",
    seasonQuestion: engine.seasonQuestion ?? "",
    escalationRule: engine.escalationRule ?? "",
    cliffhangerRule: engine.cliffhangerRule ?? "",
    tone: engine.tone ?? "",
    brandBoundaries: Array.isArray(engine.brandBoundaries) ? engine.brandBoundaries : [],
  };
}

export async function listSeries(): Promise<SeriesSummary[]> {
  const supabase = getSupabaseAdminClient();
  const [seriesResult, episodesResult] = await Promise.all([
    supabase.from("series").select("id,owner_id,title,logline,premise,genre,primary_language,secondary_language,episode_duration_seconds,status,story_engine,updated_at").order("updated_at", { ascending: false }),
    supabase.from("episodes").select("series_id"),
  ]);
  fail(seriesResult.error, "Load series");
  fail(episodesResult.error, "Load series episode counts");
  const counts = new Map<string, number>();
  for (const episode of episodesResult.data ?? []) {
    counts.set(episode.series_id, (counts.get(episode.series_id) ?? 0) + 1);
  }
  return (seriesResult.data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    logline: row.logline,
    premise: row.premise,
    genre: row.genre,
    primaryLanguage: row.primary_language,
    secondaryLanguage: row.secondary_language,
    episodeDurationSeconds: row.episode_duration_seconds,
    status: row.status,
    storyEngine: storyEngine(row.story_engine),
    episodeCount: counts.get(row.id) ?? 0,
    updatedAt: row.updated_at,
  })) as SeriesSummary[];
}

export async function getSeriesDetail(seriesId: string): Promise<SeriesDetail | null> {
  const supabase = getSupabaseAdminClient();
  const seriesResult = await supabase
    .from("series")
    .select("id,owner_id,title,logline,premise,genre,primary_language,secondary_language,episode_duration_seconds,status,story_engine,updated_at")
    .eq("id", seriesId)
    .maybeSingle();
  fail(seriesResult.error, "Load series");
  if (!seriesResult.data) return null;

  const [castResult, episodesResult] = await Promise.all([
    supabase
      .from("series_cast")
      .select("character_id,role_name,billing_order,continuity_notes,characters(name,image_url)")
      .eq("series_id", seriesId)
      .order("billing_order"),
    supabase
      .from("episodes")
      .select("id,episode_number,title,logline,opening_hook,episode_objective,cliffhanger,duration_seconds,status,master_video_url")
      .eq("series_id", seriesId)
      .order("episode_number"),
  ]);
  fail(castResult.error, "Load series cast");
  fail(episodesResult.error, "Load episodes");

  const episodeIds = (episodesResult.data ?? []).map((episode) => episode.id);
  const shotsResult = episodeIds.length
    ? await supabase
        .from("episode_shots")
        .select("id,episode_id,shot_number,duration_seconds,beat,visual_action,camera_direction,lighting_direction,dialogue,audio_direction,status,video_asset_id")
        .in("episode_id", episodeIds)
        .order("shot_number")
    : { data: [], error: null };
  fail(shotsResult.error, "Load episode shots");

  const shotsByEpisode = new Map<string, EpisodeShot[]>();
  for (const row of shotsResult.data ?? []) {
    const shots = shotsByEpisode.get(row.episode_id) ?? [];
    shots.push({
      id: row.id,
      shotNumber: row.shot_number,
      durationSeconds: row.duration_seconds,
      beat: row.beat,
      visualAction: row.visual_action,
      cameraDirection: row.camera_direction,
      lightingDirection: row.lighting_direction,
      dialogue: row.dialogue,
      audioDirection: row.audio_direction,
      status: row.status,
      videoAssetId: row.video_asset_id,
    } as EpisodeShot);
    shotsByEpisode.set(row.episode_id, shots);
  }

  const series = seriesResult.data;
  const episodes: EpisodeDetail[] = (episodesResult.data ?? []).map((row) => ({
    id: row.id,
    episodeNumber: row.episode_number,
    title: row.title,
    logline: row.logline,
    openingHook: row.opening_hook,
    episodeObjective: row.episode_objective,
    cliffhanger: row.cliffhanger,
    durationSeconds: row.duration_seconds,
    status: row.status,
    masterVideoUrl: row.master_video_url,
    shots: shotsByEpisode.get(row.id) ?? [],
  })) as EpisodeDetail[];

  return {
    id: series.id,
    ownerId: series.owner_id,
    title: series.title,
    logline: series.logline,
    premise: series.premise,
    genre: series.genre,
    primaryLanguage: series.primary_language,
    secondaryLanguage: series.secondary_language,
    episodeDurationSeconds: series.episode_duration_seconds,
    status: series.status,
    storyEngine: storyEngine(series.story_engine),
    episodeCount: episodes.length,
    updatedAt: series.updated_at,
    cast: (castResult.data ?? []).map((row) => {
      const character = Array.isArray(row.characters) ? row.characters[0] : row.characters;
      return {
        characterId: row.character_id,
        characterName: character?.name ?? "Unknown actor",
        characterImageUrl: character?.image_url ?? null,
        roleName: row.role_name,
        billingOrder: row.billing_order,
        continuityNotes: row.continuity_notes,
      };
    }),
    episodes,
  } as SeriesDetail;
}

export async function createSeries(input: NewSeriesInput): Promise<SeriesDetail> {
  const supabase = getSupabaseAdminClient();
  const seriesId = crypto.randomUUID();
  const episodeId = crypto.randomUUID();
  const now = new Date().toISOString();

  const actorCheck = await supabase
    .from("characters")
    .select("id")
    .in("id", input.cast.map((member) => member.characterId));
  fail(actorCheck.error, "Validate series cast");
  if ((actorCheck.data ?? []).length !== input.cast.length) {
    throw new Error("One or more selected actors are not in the shared catalogue.");
  }

  const seriesInsert = await supabase.from("series").insert({
    id: seriesId,
    owner_id: input.ownerId,
    title: input.title,
    logline: input.logline,
    premise: input.premise,
    genre: input.genre,
    primary_language: input.primaryLanguage,
    secondary_language: input.secondaryLanguage || null,
    episode_duration_seconds: 60,
    status: "development",
    story_engine: input.storyEngine,
    created_at: now,
    updated_at: now,
  });
  fail(seriesInsert.error, "Create series");

  try {
    const castInsert = await supabase.from("series_cast").insert(
      input.cast.map((member, index) => ({
        series_id: seriesId,
        character_id: member.characterId,
        role_name: member.roleName,
        billing_order: index + 1,
        continuity_notes: member.continuityNotes || null,
      }))
    );
    fail(castInsert.error, "Save series cast");

    const episodeInsert = await supabase.from("episodes").insert({
      id: episodeId,
      series_id: seriesId,
      episode_number: 1,
      title: input.pilot.title,
      logline: input.pilot.logline,
      opening_hook: input.pilot.openingHook,
      episode_objective: input.pilot.episodeObjective,
      cliffhanger: input.pilot.cliffhanger,
      duration_seconds: 60,
      status: "planned",
    });
    fail(episodeInsert.error, "Create pilot episode");

    const shotsInsert = await supabase.from("episode_shots").insert(
      input.pilot.shots.map((shot, index) => ({
        episode_id: episodeId,
        shot_number: index + 1,
        duration_seconds: 5,
        beat: shot.beat,
        visual_action: shot.visualAction,
        camera_direction: shot.cameraDirection,
        lighting_direction: shot.lightingDirection,
        dialogue: shot.dialogue || null,
        audio_direction: shot.audioDirection || null,
        continuity_in: index === 0 ? { source: "series_bible" } : { previousShot: index },
        continuity_out: index === 11 ? { cliffhanger: input.pilot.cliffhanger } : { nextShot: index + 2 },
        status: "planned",
      }))
    );
    fail(shotsInsert.error, "Create pilot shot plan");
  } catch (error) {
    await supabase.from("series").delete().eq("id", seriesId);
    throw error;
  }

  const created = await getSeriesDetail(seriesId);
  if (!created) throw new Error("The series was saved but could not be reloaded.");
  return created;
}

