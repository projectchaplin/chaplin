// Project Chaplin: core data model.
// This is the traceability spine: every entity below carries the IDs that
// let you walk the full chain, character -> castings -> stories -> scenes
// -> ledger entries -> maker earnings, from any screen in the app.

export type Archetype =
  | "villain"
  | "mentor"
  | "love-interest"
  | "comic-relief"
  | "hero"
  | "rebel"
  | "sidekick"
  | "outsider";

export type LicenseType = "open" | "paid" | "approval";

export interface User {
  id: string;
  name: string;
  handle: string;
  roleBadges: Array<"maker" | "caster">;
  avatarInitial: string;
  avatarHue: number; // 0-360, used to color the monogram poster (fallback when imageUrl is unset)
  imageUrl?: string;
}

export interface CharacterStats {
  castings: number;
  fans: number;
  earnings: number; // lifetime, in mock currency units
}

export interface Character {
  id: string;
  makerId: string;
  name: string;
  archetype: Archetype;
  tagline: string;
  personality: string;
  voiceDesc: string;
  sfxDesc: string; // signature sound effect, same mock pattern as voiceDesc
  themeDesc: string; // signature background score, same mock pattern as voiceDesc
  avatarHue: number; // fallback color when imageUrl is unset (e.g. freshly built characters)
  imageUrl?: string;
  licenseType: LicenseType;
  royaltyRate: number; // fee per casting, in mock currency units (0 if open)
  createdAt: string; // ISO date
  stats: CharacterStats;
}

export interface VoiceClipMock {
  durationSec: number;
  waveformSeed: number; // seeds a deterministic-looking fake waveform
}

export interface Line {
  id: string;
  characterId: string;
  text: string;
  voiceClipMock: VoiceClipMock;
}

export interface Scene {
  id: string;
  setting: string;
  lines: Line[];
}

export interface Story {
  id: string;
  authorId: string;
  title: string;
  logline: string;
  coverHue: number; // fallback gradient when backdropUrl is unset
  backdropUrl?: string;
  posterUrl?: string; // finished portrait poster art (title baked in) shown on the story page
  createdAt: string; // ISO date
  scenes: Scene[];
  views: number;
}

export interface Casting {
  id: string;
  characterId: string;
  storyId: string;
  casterId: string;
  timestamp: string; // ISO date
  fee: number;
}

export type LedgerType = "royalty" | "tip";

export interface LedgerEntry {
  id: string;
  castingId: string;
  characterId: string;
  storyId: string;
  makerId: string;
  amount: number;
  type: LedgerType;
  timestamp: string; // ISO date
}

export interface ChaplinWorld {
  users: User[];
  characters: Character[];
  stories: Story[];
  castings: Casting[];
  ledger: LedgerEntry[];
}
