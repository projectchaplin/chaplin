export type SeriesStatus = "development" | "production" | "published" | "archived";
export type EpisodeStatus =
  | "planned"
  | "generating"
  | "ready_to_assemble"
  | "assembling"
  | "assembled"
  | "published"
  | "failed";
export type EpisodeShotStatus = "planned" | "generating" | "ready" | "failed";

export interface SeriesStoryEngine {
  audiencePromise: string;
  centralConflict: string;
  seasonQuestion: string;
  escalationRule: string;
  cliffhangerRule: string;
  tone: string;
  brandBoundaries: string[];
}

export interface SeriesSummary {
  id: string;
  ownerId: string | null;
  title: string;
  logline: string;
  premise: string;
  genre: string;
  primaryLanguage: string;
  secondaryLanguage: string | null;
  episodeDurationSeconds: 60 | 120;
  status: SeriesStatus;
  storyEngine: SeriesStoryEngine;
  episodeCount: number;
  updatedAt: string;
}

export interface SeriesCastMember {
  characterId: string;
  characterName: string;
  characterImageUrl: string | null;
  roleName: string;
  billingOrder: number;
  continuityNotes: string | null;
}

export interface EpisodeShot {
  id: string;
  shotNumber: number;
  durationSeconds: 5;
  beat: string;
  visualAction: string;
  cameraDirection: string;
  lightingDirection: string;
  dialogue: string | null;
  audioDirection: string | null;
  status: EpisodeShotStatus;
  videoAssetId: string | null;
}

export interface EpisodeDetail {
  id: string;
  episodeNumber: number;
  title: string;
  logline: string;
  openingHook: string;
  episodeObjective: string;
  cliffhanger: string;
  durationSeconds: 60 | 120;
  status: EpisodeStatus;
  masterVideoUrl: string | null;
  shots: EpisodeShot[];
}

export interface SeriesDetail extends SeriesSummary {
  cast: SeriesCastMember[];
  episodes: EpisodeDetail[];
}

export interface NewSeriesInput {
  ownerId: string;
  title: string;
  logline: string;
  premise: string;
  genre: string;
  primaryLanguage: string;
  secondaryLanguage?: string;
  cast: Array<{
    characterId: string;
    roleName: string;
    continuityNotes?: string;
  }>;
  storyEngine: SeriesStoryEngine;
  pilot: {
    title: string;
    logline: string;
    openingHook: string;
    episodeObjective: string;
    cliffhanger: string;
    shots: Array<{
      beat: string;
      visualAction: string;
      cameraDirection: string;
      lightingDirection: string;
      dialogue?: string;
      audioDirection?: string;
    }>;
  };
}

