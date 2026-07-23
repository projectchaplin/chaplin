export type Archetype =
  | "villain"
  | "mentor"
  | "love-interest"
  | "comic-relief"
  | "hero"
  | "superhero"
  | "horror"
  | "rebel"
  | "sidekick"
  | "outsider";

export type VoiceGender = "feminine" | "masculine" | "androgynous";

export type Character = {
  id: string;
  makerId: string;
  name: string;
  archetype: Archetype;
  archetypeMix?: Archetype[];
  tagline: string;
  personality: string;
  voiceGender: VoiceGender;
  voiceDesc: string;
  voiceId?: string;
  sfxDesc: string;
  themeDesc: string;
  brollLine?: string;
  brollScene?: string;
  avatarHue: number;
  imageUrl?: string;
  bannerUrl?: string;
  videoUrl?: string;
  galleryUrls?: string[];
  licenseType: "open" | "paid" | "approval";
  royaltyRate: number;
  createdAt: string;
  stats: { castings: number; fans: number; earnings: number };
  productionBible?: Record<string, unknown>;
};

export type CharacterSuggestion = {
  tagline: string;
  personality: string;
  voiceGender: VoiceGender;
  voiceDescription: string;
  signatureSfx: string;
  themeScore: string;
  productionBible?: Record<string, unknown>;
};

export type SparkScene = {
  setting: string;
  objective: string;
  action: string;
  lines: { characterId: string; text: string }[];
};

export type SparkDraft = {
  id?: string;
  format: "spark";
  title: string;
  logline: string;
  creativeDirection: string;
  castIds: string[];
  scenes: SparkScene[];
  updatedAt?: string;
};

export type ProductionAsset = {
  id: string;
  characterId: string;
  kind: string;
  url: string;
  createdAt: string;
  status?: string;
};

export type LibraryItem = {
  id: string;
  characterId: string;
  characterName: string;
  kind: string;
  url: string;
  createdAt: string;
};

export type MobileIdentity = {
  id: string;
  email: string;
  name: string;
  role: "creator" | "brand" | "admin";
};

export type GenerationState = {
  production?: {
    voiceId?: string | null;
    visualReference?: { id: string; url: string; source?: string } | null;
    assets?: ProductionAsset[];
  } | null;
  providers?: Record<string, unknown> | null;
};

export const archetypes: { value: Archetype; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "villain", label: "Villain" },
  { value: "comic-relief", label: "Comic" },
  { value: "mentor", label: "Mentor" },
  { value: "rebel", label: "Rebel" },
  { value: "outsider", label: "Outsider" },
  { value: "superhero", label: "Superhero" },
  { value: "horror", label: "Horror" },
];
