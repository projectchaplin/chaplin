import "server-only";

import { createClient } from "@supabase/supabase-js";
import { buildProductionBible } from "@/lib/production-prompting";
import { SEED_WORLD } from "@/data/seed";
import type { GenerationBilling } from "@/lib/server/billing";
import type { Character } from "@/lib/types";

export interface AdminCharacterRow {
  id: string;
  name: string;
  archetype: string;
  tagline: string;
  image_url: string | null;
  banner_url: string | null;
  license_type: string;
  updated_at: string;
}

export interface AdminVoiceRow {
  character_id: string;
  provider_voice_id: string;
  status: string;
}

export interface AdminAssetRow {
  id: string;
  character_id: string | null;
  kind: string;
  provider: string;
  url: string;
  created_at: string;
}

export interface AdminJobRow {
  id: string;
  character_id: string | null;
  kind: string;
  provider: string;
  model: string;
  status: string;
  prompt: string | null;
  provider_request_id: string | null;
  output_asset_id: string | null;
  error_message: string | null;
  usage: Record<string, unknown>;
  provider_credits: number | null;
  normalized_tokens: number | null;
  cost_usd: number | null;
  usd_to_inr_rate: number | null;
  cost_inr: number | null;
  cost_method: string | null;
  pricing_note: string | null;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AdminHomeSlotRow {
  character_id: string;
  position: number;
  status: string;
  editorial_note: string | null;
}

export interface AdminDashboardData {
  characters: AdminCharacterRow[];
  voices: AdminVoiceRow[];
  assets: AdminAssetRow[];
  jobs: AdminJobRow[];
  homeSlots: AdminHomeSlotRow[];
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin environment variables are not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assert(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function characterRow(character: Character) {
  return {
    id: character.id,
    maker_id: character.makerId,
    name: character.name,
    archetype: character.archetype,
    tagline: character.tagline,
    personality: character.personality,
    voice_gender: character.voiceGender,
    voice_description: character.voiceDesc,
    sfx_description: character.sfxDesc,
    theme_description: character.themeDesc,
    production_bible: character.productionBible ?? buildProductionBible(character),
    avatar_hue: character.avatarHue,
    image_url: character.imageUrl ?? null,
    banner_url: character.bannerUrl ?? null,
    license_type: character.licenseType,
    royalty_rate: character.royaltyRate,
    castings_count: character.stats.castings,
    fans_count: character.stats.fans,
    earnings_total: character.stats.earnings,
    created_at: character.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export async function persistCharacter(character: Character) {
  const { error } = await adminClient()
    .from("characters")
    .upsert(characterRow(character), { onConflict: "id" });
  assert(error, "Save AI actor");
}

export async function ensureCharacter(character: Character) {
  const { error } = await adminClient()
    .from("characters")
    .upsert(characterRow(character), { onConflict: "id" });
  assert(error, "Register AI actor for generation");
}

interface CharacterCatalogRow {
  id: string;
  maker_id: string | null;
  name: string;
  archetype: Character["archetype"];
  tagline: string;
  personality: string;
  voice_gender: Character["voiceGender"];
  voice_description: string;
  sfx_description: string;
  theme_description: string;
  production_bible: Character["productionBible"] | null;
  avatar_hue: number;
  image_url: string | null;
  banner_url: string | null;
  license_type: Character["licenseType"];
  royalty_rate: number;
  castings_count: number;
  fans_count: number;
  earnings_total: number;
  created_at: string;
  featured_voice_asset_id: string | null;
  featured_theme_asset_id: string | null;
  featured_video_asset_id: string | null;
  featured_cover_asset_id: string | null;
}

/** Returns the shared actor catalogue used by every browser and device. */
export async function listCharacters(): Promise<Character[]> {
  const supabase = adminClient();
  const [characters, voices, assets] = await Promise.all([
    supabase
      .from("characters")
      .select("id,maker_id,name,archetype,tagline,personality,voice_gender,voice_description,sfx_description,theme_description,production_bible,avatar_hue,image_url,banner_url,license_type,royalty_rate,castings_count,fans_count,earnings_total,created_at,featured_voice_asset_id,featured_theme_asset_id,featured_video_asset_id,featured_cover_asset_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("character_voices")
      .select("character_id,provider_voice_id")
      .eq("status", "active"),
    supabase
      .from("media_assets")
      .select("id,character_id,kind,url,created_at")
      .in("kind", ["avatar", "banner", "gallery", "video"])
      .not("character_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  assert(characters.error, "Load AI actors");
  assert(voices.error, "Load AI actor voices");
  assert(assets.error, "Load AI actor media");

  const voiceByCharacter = new Map(
    (voices.data ?? []).map((voice) => [voice.character_id, voice.provider_voice_id])
  );
  const mediaByCharacter = new Map<string, { avatar?: string; banner?: string; video?: string; gallery: string[] }>();
  for (const asset of assets.data ?? []) {
    if (!asset.character_id) continue;
    const media = mediaByCharacter.get(asset.character_id) ?? { gallery: [] };
    if (asset.kind === "gallery") media.gallery.push(asset.url);
    if (asset.kind === "avatar" && !media.avatar) media.avatar = asset.url;
    if (asset.kind === "banner" && !media.banner) media.banner = asset.url;
    if (asset.kind === "video" && !media.video) media.video = asset.url;
    mediaByCharacter.set(asset.character_id, media);
  }

  return ((characters.data ?? []) as CharacterCatalogRow[]).map((row) => {
    const media = mediaByCharacter.get(row.id);
    const characterAssets = (assets.data ?? []).filter((asset) => asset.character_id === row.id);
    const featuredCover = characterAssets.find((asset) => asset.id === row.featured_cover_asset_id)?.url;
    const featuredVideo = characterAssets.find((asset) => asset.id === row.featured_video_asset_id)?.url;
    return {
      id: row.id,
      makerId: row.maker_id ?? "u-admin",
      name: row.name,
      archetype: row.archetype,
      tagline: row.tagline,
      personality: row.personality,
      voiceGender: row.voice_gender,
      voiceDesc: row.voice_description,
      voiceId: voiceByCharacter.get(row.id),
      sfxDesc: row.sfx_description,
      themeDesc: row.theme_description,
      productionBible: row.production_bible ?? undefined,
      avatarHue: row.avatar_hue,
      imageUrl: featuredCover ?? media?.gallery[0] ?? media?.avatar ?? row.image_url ?? undefined,
      bannerUrl: featuredCover ?? media?.banner ?? row.banner_url ?? undefined,
      videoUrl: featuredVideo ?? media?.video,
      galleryUrls: media?.gallery.length ? media.gallery : undefined,
      licenseType: row.license_type,
      royaltyRate: Number(row.royalty_rate),
      createdAt: row.created_at,
      stats: {
        castings: row.castings_count,
        fans: row.fans_count,
        earnings: Number(row.earnings_total),
      },
    };
  });
}

export async function seedAdminCatalog() {
  const supabase = adminClient();

  const users = SEED_WORLD.users.map((user) => ({
    id: user.id,
    name: user.name,
    handle: user.handle,
    role_badges: user.roleBadges,
    avatar_initial: user.avatarInitial,
    avatar_hue: user.avatarHue,
    image_url: user.imageUrl ?? null,
    updated_at: new Date().toISOString(),
  }));
  assert((await supabase.from("users").upsert(users)).error, "Seed users");

  const characters = SEED_WORLD.characters.map(characterRow);
  assert((await supabase.from("characters").upsert(characters)).error, "Seed characters");

  const stories = SEED_WORLD.stories.map((story) => ({
    id: story.id,
    author_id: story.authorId,
    title: story.title,
    logline: story.logline,
    cover_hue: story.coverHue,
    backdrop_url: story.backdropUrl ?? null,
    poster_url: story.posterUrl ?? null,
    views: story.views,
    created_at: story.createdAt,
    updated_at: new Date().toISOString(),
  }));
  assert((await supabase.from("stories").upsert(stories)).error, "Seed stories");

  const scenes = SEED_WORLD.stories.flatMap((story) =>
    story.scenes.map((scene, position) => ({
      id: scene.id,
      story_id: story.id,
      setting: scene.setting,
      position,
    }))
  );
  assert((await supabase.from("scenes").upsert(scenes)).error, "Seed scenes");

  const lines = SEED_WORLD.stories.flatMap((story) =>
    story.scenes.flatMap((scene) =>
      scene.lines.map((line, position) => ({
        id: `${scene.id}-line-${position}`,
        scene_id: scene.id,
        character_id: line.characterId,
        text: line.text,
        position,
        duration_seconds: line.voiceClipMock.durationSec,
        waveform_seed: line.voiceClipMock.waveformSeed,
      }))
    )
  );
  assert((await supabase.from("scene_lines").upsert(lines)).error, "Seed scene lines");

  const castings = SEED_WORLD.castings.map((casting) => ({
    id: casting.id,
    character_id: casting.characterId,
    story_id: casting.storyId,
    caster_id: casting.casterId,
    fee: casting.fee,
    status: "approved",
    created_at: casting.timestamp,
  }));
  assert((await supabase.from("castings").upsert(castings)).error, "Seed castings");

  const ledger = SEED_WORLD.ledger.map((entry) => ({
    id: entry.id,
    casting_id: entry.castingId,
    character_id: entry.characterId,
    story_id: entry.storyId,
    maker_id: entry.makerId,
    amount: entry.amount,
    type: entry.type,
    created_at: entry.timestamp,
  }));
  assert((await supabase.from("ledger_entries").upsert(ledger)).error, "Seed ledger");

  assert(
    (await supabase.from("media_assets").delete().eq("provider", "seed")).error,
    "Refresh seed media"
  );
  const assets = SEED_WORLD.characters.flatMap((character) => {
    const rows: Array<Record<string, unknown>> = [];
    if (character.imageUrl) rows.push({ character_id: character.id, kind: "avatar", provider: "seed", url: character.imageUrl });
    if (character.bannerUrl) rows.push({ character_id: character.id, kind: "banner", provider: "seed", url: character.bannerUrl });
    if (character.videoUrl) rows.push({ character_id: character.id, kind: "video", provider: "seed", url: character.videoUrl, duration_seconds: 5 });
    for (const url of character.galleryUrls ?? []) {
      rows.push({ character_id: character.id, kind: "gallery", provider: "seed", url });
    }
    return rows;
  });
  if (assets.length > 0) assert((await supabase.from("media_assets").insert(assets)).error, "Seed media");

  const slots = SEED_WORLD.characters.slice(0, 8).map((character, position) => ({
    character_id: character.id,
    position: position + 1,
    status: "draft",
    editorial_note: position === 0 ? "Primary homepage feature candidate" : null,
    updated_at: new Date().toISOString(),
  }));
  assert(
    (await supabase.from("home_slots").upsert(slots, { onConflict: "character_id" })).error,
    "Seed homepage slots"
  );

  return {
    users: users.length,
    characters: characters.length,
    stories: stories.length,
    assets: assets.length,
  };
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const supabase = adminClient();
  const [characters, voices, assets, jobs, homeSlots] = await Promise.all([
    supabase.from("characters").select("id,name,archetype,tagline,image_url,banner_url,license_type,updated_at").order("name"),
    supabase.from("character_voices").select("character_id,provider_voice_id,status"),
    supabase.from("media_assets").select("id,character_id,kind,provider,url,created_at").order("created_at", { ascending: false }),
    supabase.from("generation_jobs").select("id,character_id,kind,provider,model,status,prompt,provider_request_id,output_asset_id,error_message,usage,provider_credits,normalized_tokens,cost_usd,usd_to_inr_rate,cost_inr,cost_method,pricing_note,metadata,started_at,completed_at,created_at").order("created_at", { ascending: false }),
    supabase.from("home_slots").select("character_id,position,status,editorial_note").order("position"),
  ]);

  assert(characters.error, "Load characters");
  assert(voices.error, "Load voices");
  assert(assets.error, "Load media");
  assert(jobs.error, "Load generation jobs");
  assert(homeSlots.error, "Load homepage slots");

  return {
    characters: (characters.data ?? []) as AdminCharacterRow[],
    voices: (voices.data ?? []) as AdminVoiceRow[],
    assets: (assets.data ?? []) as AdminAssetRow[],
    jobs: (jobs.data ?? []) as AdminJobRow[],
    homeSlots: (homeSlots.data ?? []) as AdminHomeSlotRow[],
  };
}

export async function getCharacterProductionState(characterId: string) {
  const supabase = adminClient();
  const [voice, assets, character] = await Promise.all([
    supabase
      .from("character_voices")
      .select("provider_voice_id,preview_url")
      .eq("character_id", characterId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("media_assets")
      .select("id,kind,url,provider,prompt,duration_seconds,metadata,created_at")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false }),
    supabase
      .from("characters")
      .select("image_url,banner_url,featured_voice_asset_id,featured_theme_asset_id,featured_video_asset_id,featured_cover_asset_id")
      .eq("id", characterId)
      .single(),
  ]);
  assert(voice.error, "Load character voice");
  assert(assets.error, "Load character media");
  assert(character.error, "Load featured character media");
  if (!character.data) throw new Error("Load featured character media: AI actor not found.");
  const rows = assets.data ?? [];
  const featured = character.data;
  const activeVoiceId = voice.data?.provider_voice_id ?? null;
  const featuredDialogue = rows.find((asset) => asset.id === featured.featured_voice_asset_id);
  const latestDialogue = featuredDialogue ?? rows.find((asset) => {
    if (asset.kind !== "dialogue" || !activeVoiceId) return false;
    const metadata = asset.metadata as Record<string, unknown> | null;
    return metadata?.voiceId === activeVoiceId;
  });
  const featuredVideo = rows.find((asset) => asset.id === featured.featured_video_asset_id);
  const latestVideo = featuredVideo ??
    rows.find((asset) => asset.kind === "video" && asset.url.startsWith("https://")) ??
    rows.find((asset) => asset.kind === "video");
  const featuredTheme = rows.find((asset) => asset.id === featured.featured_theme_asset_id);
  const featuredSfx = rows.find((asset) => {
    if (asset.kind !== "sfx") return false;
    const metadata = asset.metadata as Record<string, unknown> | null;
    return metadata?.featuredSfx === true;
  });
  const featuredCover = rows.find((asset) => asset.id === featured.featured_cover_asset_id);
  const identityReference = rows.find((asset) => {
    if (asset.kind !== "gallery") return false;
    const metadata = asset.metadata as Record<string, unknown> | null;
    return metadata?.imagePurpose === "identity" || asset.provider === "upload";
  });
  const fallbackReference = rows.find((asset) => ["gallery", "avatar", "banner"].includes(asset.kind));
  const visualReference = featuredCover
    ? { url: featuredCover.url, assetId: featuredCover.id, source: "selected-cover" as const }
    : identityReference
      ? { url: identityReference.url, assetId: identityReference.id, source: "identity-asset" as const }
      : featured.image_url
        ? { url: featured.image_url, assetId: null, source: "character-image" as const }
        : fallbackReference
          ? { url: fallbackReference.url, assetId: fallbackReference.id, source: "character-media" as const }
          : featured.banner_url
            ? { url: featured.banner_url, assetId: null, source: "character-banner" as const }
            : null;

  return {
    voiceId: activeVoiceId,
    voicePreviewUrl: voice.data?.preview_url ?? null,
    latestDialogueUrl: latestDialogue?.url ?? null,
    latestSfxUrl: featuredSfx?.url ?? rows.find((asset) => asset.kind === "sfx")?.url ?? null,
    latestThemeUrl: featuredTheme?.url ?? rows.find((asset) => asset.kind === "theme")?.url ?? null,
    latestImageUrl: featuredCover?.url ?? rows.find((asset) => asset.kind === "gallery")?.url ?? null,
    latestVideoUrl: latestVideo?.url ?? null,
    visualReference,
    featured: {
      voiceAssetId: featured.featured_voice_asset_id,
      themeAssetId: featured.featured_theme_asset_id,
      videoAssetId: featured.featured_video_asset_id,
      coverAssetId: featured.featured_cover_asset_id,
    },
    assets: rows,
  };
}

export async function selectCharacterSfxAsset(input: { characterId: string; assetId: string }) {
  const supabase = adminClient();
  const assets = await supabase
    .from("media_assets")
    .select("id,url,metadata")
    .eq("character_id", input.characterId)
    .eq("kind", "sfx");
  assert(assets.error, "Load character SFX takes");
  const selected = (assets.data ?? []).find((asset) => asset.id === input.assetId);
  if (!selected) throw new Error("Select character SFX: take not found.");

  const updates = await Promise.all((assets.data ?? []).map((asset) => {
    const metadata = asset.metadata && typeof asset.metadata === "object"
      ? asset.metadata as Record<string, unknown>
      : {};
    return supabase
      .from("media_assets")
      .update({ metadata: { ...metadata, featuredSfx: asset.id === input.assetId } })
      .eq("id", asset.id);
  }));
  for (const update of updates) assert(update.error, "Select character SFX");
  return { assetId: selected.id, url: selected.url };
}

export type CharacterProfileSlot = "voice" | "theme" | "video" | "cover";

const PROFILE_SLOT_COLUMNS: Record<CharacterProfileSlot, string> = {
  voice: "featured_voice_asset_id",
  theme: "featured_theme_asset_id",
  video: "featured_video_asset_id",
  cover: "featured_cover_asset_id",
};

const PROFILE_SLOT_KINDS: Record<CharacterProfileSlot, string[]> = {
  voice: ["dialogue"],
  theme: ["theme"],
  video: ["video"],
  cover: ["gallery", "avatar", "banner"],
};

export async function selectCharacterProfileMedia(input: {
  characterId: string;
  assetId: string;
  slot: CharacterProfileSlot;
}) {
  const supabase = adminClient();
  const asset = await supabase
    .from("media_assets")
    .select("id,character_id,kind,url,metadata")
    .eq("id", input.assetId)
    .eq("character_id", input.characterId)
    .single();
  assert(asset.error, "Load selected profile media");
  if (!asset.data) throw new Error("Load selected profile media: asset not found.");
  if (!PROFILE_SLOT_KINDS[input.slot].includes(asset.data.kind)) {
    throw new Error(`This asset cannot be used as the profile ${input.slot}.`);
  }

  if (input.slot === "voice") {
    const metadata = asset.data.metadata as Record<string, unknown> | null;
    const voiceId = typeof metadata?.voiceId === "string" ? metadata.voiceId : null;
    if (!voiceId) throw new Error("This dialogue take is not linked to a locked voice.");
    const voiceUpdate = await supabase
      .from("character_voices")
      .update({
        provider_voice_id: voiceId,
        preview_url: asset.data.url,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("character_id", input.characterId)
      .eq("provider", "elevenlabs");
    assert(voiceUpdate.error, "Select main character voice");
  }

  const update = await supabase
    .from("characters")
    .update({
      [PROFILE_SLOT_COLUMNS[input.slot]]: input.assetId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.characterId);
  assert(update.error, "Select profile media");
  return { slot: input.slot, assetId: input.assetId, url: asset.data.url };
}

export async function getHomepageBrollState() {
  const supabase = adminClient();
  const [assets, voices, selections] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id,character_id,kind,url,metadata,created_at")
      .in("kind", ["video", "dialogue", "theme"])
      .not("character_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("character_voices")
      .select("character_id,provider_voice_id")
      .eq("status", "active"),
    supabase
      .from("characters")
      .select("id,featured_voice_asset_id,featured_theme_asset_id,featured_video_asset_id"),
  ]);
  assert(assets.error, "Load homepage B-roll");
  assert(voices.error, "Load homepage B-roll voices");
  assert(selections.error, "Load homepage profile selections");
  const activeVoices = new Map((voices.data ?? []).map((voice) => [voice.character_id, voice.provider_voice_id]));

  const characters = new Map<string, {
    characterId: string;
    videoUrl: string | null;
    dialogueUrl: string | null;
    themeUrl: string | null;
  }>();
  const assetsById = new Map((assets.data ?? []).map((asset) => [asset.id, asset]));
  for (const selection of selections.data ?? []) {
    const selectedVideo = assetsById.get(selection.featured_video_asset_id);
    const selectedVoice = assetsById.get(selection.featured_voice_asset_id);
    const selectedTheme = assetsById.get(selection.featured_theme_asset_id);
    if (!selectedVideo && !selectedVoice && !selectedTheme) continue;
    characters.set(selection.id, {
      characterId: selection.id,
      videoUrl: selectedVideo?.url ?? null,
      dialogueUrl: selectedVoice?.url ?? null,
      themeUrl: selectedTheme?.url ?? null,
    });
  }
  for (const asset of assets.data ?? []) {
    if (!asset.character_id) continue;
    const entry = characters.get(asset.character_id) ?? {
      characterId: asset.character_id,
      videoUrl: null,
      dialogueUrl: null,
      themeUrl: null,
    };
    if (asset.kind === "video" && !entry.videoUrl) {
      entry.videoUrl = asset.url;
    }
    if (asset.kind === "dialogue" && !entry.dialogueUrl) {
      const metadata = asset.metadata as Record<string, unknown> | null;
      if (metadata?.voiceId === activeVoices.get(asset.character_id)) entry.dialogueUrl = asset.url;
    }
    if (asset.kind === "theme" && !entry.themeUrl) entry.themeUrl = asset.url;
    characters.set(asset.character_id, entry);
  }
  return [...characters.values()].filter((entry) => entry.videoUrl);
}

export async function getCharacterProviderHealth(characterId: string) {
  const supabase = adminClient();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const staleResult = await supabase
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: "Generation was interrupted before the provider returned a result.",
      completed_at: new Date().toISOString(),
    })
    .eq("character_id", characterId)
    .eq("status", "running")
    .lt("started_at", staleBefore);
  assert(staleResult.error, "Recover interrupted generation jobs");

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("provider,status,error_message,created_at")
    .eq("character_id", characterId)
    .in("provider", ["elevenlabs", "byteplus", "fal"])
    .order("created_at", { ascending: false })
    .limit(50);
  assert(error, "Load provider health");

  const latest = (provider: "elevenlabs" | "byteplus" | "fal") => {
    const providerJobs = (data ?? []).filter((row) => row.provider === provider);
    const job = providerJobs[0];
    const lastSuccess = providerJobs.find((row) => row.status === "succeeded");
    return job
      ? {
          status: job.status as string,
          error: (job.error_message as string | null) ?? null,
          updatedAt: job.created_at as string,
          hasSucceeded: Boolean(lastSuccess),
          lastSucceededAt: lastSuccess ? (lastSuccess.created_at as string) : null,
        }
      : null;
  };

  return {
    elevenLabs: latest("elevenlabs"),
    seedModels: latest("byteplus") ?? latest("fal"),
  };
}

export function getSupabaseAdminClient() {
  return adminClient();
}

export async function beginGeneration(input: {
  characterId: string;
  kind: string;
  provider: string;
  model: string;
  prompt?: string;
}) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .insert({
      character_id: input.characterId,
      kind: input.kind,
      provider: input.provider,
      model: input.model,
      prompt: input.prompt ?? null,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert(error, "Start generation job");
  if (!data) throw new Error("Start generation job returned no record.");
  return data.id as string;
}

function generationFeedCopy(kind: string, characterName: string, prompt: string | null) {
  const cleanPrompt = prompt?.replace(/\s+/g, " ").trim().slice(0, 320);
  if (kind === "dialogue") return `New dialogue take for ${characterName}.${cleanPrompt ? `\n“${cleanPrompt}”` : ""}`;
  if (kind === "sfx") return `New sound effect for ${characterName}.${cleanPrompt ? ` ${cleanPrompt}` : ""}`;
  if (kind === "theme") return `New theme for ${characterName}.${cleanPrompt ? ` ${cleanPrompt}` : ""}`;
  if (kind === "video") return `${characterName} has a new scene in motion.`;
  if (kind === "gallery") return `New scene frame for ${characterName}.`;
  if (kind === "avatar") return `${characterName} has a new identity portrait.`;
  if (kind === "banner") return `${characterName} has a new hero cover.`;
  return `New production output for ${characterName}.`;
}

async function publishGenerationToFeed(jobId: string, assetId: string) {
  const supabase = adminClient();
  const [jobResult, assetResult] = await Promise.all([
    supabase.from("generation_jobs").select("character_id,kind").eq("id", jobId).maybeSingle(),
    supabase.from("media_assets").select("id,kind,url,prompt,created_at").eq("id", assetId).maybeSingle(),
  ]);
  assert(jobResult.error, "Load feed generation");
  assert(assetResult.error, "Load feed asset");
  const job = jobResult.data;
  const asset = assetResult.data;
  if (!job?.character_id || !asset?.url) return;

  const characterResult = await supabase
    .from("characters")
    .select("name,maker_id")
    .eq("id", job.character_id)
    .maybeSingle();
  assert(characterResult.error, "Load feed actor");
  const character = characterResult.data;
  if (!character?.maker_id) return;

  const existing = await supabase
    .from("feed_posts")
    .select("id")
    .eq("source_asset_id", assetId)
    .maybeSingle();
  assert(existing.error, "Check feed generation");
  if (existing.data) return;

  const kind = String(asset.kind ?? job.kind);
  const mediaKind = ["dialogue", "sfx", "theme"].includes(kind)
    ? "audio"
    : kind === "video"
      ? "video"
      : "image";
  const insert = await supabase.from("feed_posts").insert({
    author_id: character.maker_id,
    body: generationFeedCopy(kind, character.name, asset.prompt),
    media_kind: mediaKind,
    media_url: asset.url,
    source_asset_id: assetId,
    created_at: asset.created_at,
  });
  if (insert.error && insert.error.code !== "23505") {
    throw new Error(`Publish generation to feed: ${insert.error.message}`);
  }
}

export async function completeGeneration(
  jobId: string,
  assetId?: string,
  metadata?: object,
  billing?: GenerationBilling,
  providerRequestId?: string | null
) {
  const supabase = adminClient();
  assert(
    (
      await supabase
        .from("generation_jobs")
        .update({
          status: "succeeded",
          provider_request_id: providerRequestId ?? null,
          output_asset_id: assetId ?? null,
          usage: billing?.usage ?? {},
          provider_credits: billing?.providerCredits ?? null,
          normalized_tokens: billing?.normalizedTokens ?? null,
          cost_usd: billing?.costUsd ?? null,
          usd_to_inr_rate: billing?.usdToInrRate ?? null,
          cost_inr: billing?.costInr ?? null,
          cost_method: billing?.costMethod ?? null,
          pricing_note: billing?.pricingNote ?? null,
          metadata: metadata ?? {},
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
    ).error,
    "Complete generation job"
  );
  if (assetId) {
    try {
      await publishGenerationToFeed(jobId, assetId);
    } catch (feedError) {
      // The paid provider output is already safely persisted. A social-feed
      // side effect must never make a successful generation look failed.
      console.error("Publish generation to feed:", feedError);
    }
  }
}

export async function failGeneration(jobId: string, message: string) {
  const supabase = adminClient();
  await supabase
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function saveCharacterVoice(input: {
  characterId: string;
  voiceId: string;
  description: string;
  previewUrl?: string | null;
}) {
  const supabase = adminClient();
  const { error } = await supabase.from("character_voices").upsert(
    {
      character_id: input.characterId,
      provider: "elevenlabs",
      provider_voice_id: input.voiceId,
      description: input.description,
      preview_url: input.previewUrl ?? null,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "character_id,provider" }
  );
  assert(error, "Save character voice");
  const resetFeaturedVoice = await supabase
    .from("characters")
    .update({ featured_voice_asset_id: null, updated_at: new Date().toISOString() })
    .eq("id", input.characterId);
  assert(resetFeaturedVoice.error, "Reset featured voice take");
}

function extensionFor(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("video")) return "mp4";
  return "mp3";
}

export async function saveMediaAsset(input: {
  characterId: string;
  kind: "avatar" | "banner" | "gallery" | "dialogue" | "sfx" | "theme" | "video";
  provider: string;
  bytes: ArrayBuffer;
  contentType: string;
  prompt?: string;
  durationSeconds?: number;
  metadata?: object;
}) {
  const supabase = adminClient();
  const storagePath = `${input.characterId}/${input.kind}/${crypto.randomUUID()}.${extensionFor(input.contentType)}`;
  const upload = await supabase.storage.from("character-media").upload(storagePath, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  assert(upload.error, "Upload generated media");
  const publicUrl = supabase.storage.from("character-media").getPublicUrl(storagePath).data.publicUrl;
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      character_id: input.characterId,
      kind: input.kind,
      provider: input.provider,
      url: publicUrl,
      storage_path: storagePath,
      prompt: input.prompt ?? null,
      duration_seconds: input.durationSeconds ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id,url")
    .single();
  assert(error, "Save generated media");
  if (!data) throw new Error("Save generated media returned no record.");
  if (input.kind === "avatar" || input.kind === "banner") {
    const column = input.kind === "avatar" ? "image_url" : "banner_url";
    assert(
      (await supabase.from("characters").update({ [column]: publicUrl, updated_at: new Date().toISOString() }).eq("id", input.characterId)).error,
      `Update character ${input.kind}`
    );
  }
  return data as { id: string; url: string };
}

export async function saveRemoteMediaAsset(input: Omit<Parameters<typeof saveMediaAsset>[0], "bytes" | "contentType"> & { remoteUrl: string }) {
  const response = await fetch(input.remoteUrl);
  if (!response.ok) throw new Error(`Could not archive generated media (${response.status}).`);
  const contentType = response.headers.get("content-type") ?? (input.kind === "video" ? "video/mp4" : "image/png");
  return saveMediaAsset({
    ...input,
    bytes: await response.arrayBuffer(),
    contentType,
  });
}
