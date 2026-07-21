"use client";

import { create } from "zustand";
import { SEED_WORLD } from "@/data/seed";
import type {
  Character,
  Story,
  Casting,
  LedgerEntry,
  ChaplinWorld,
  AppRole,
  LicenseType,
} from "@/lib/types";

const STORAGE_KEY = "chaplin:v15";

export type NewCharacterInput = Pick<
  Character,
  | "name"
  | "archetype"
  | "tagline"
  | "personality"
  | "voiceGender"
  | "voiceDesc"
  | "sfxDesc"
  | "themeDesc"
  | "licenseType"
  | "royaltyRate"
  | "avatarHue"
> & { makerId: string };

export interface NewSceneInput {
  setting: string;
  objective?: string;
  action?: string;
  lines: Array<{ characterId: string; text: string }>;
}

export interface NewStoryInput {
  title: string;
  logline: string;
  format?: "story" | "ad" | "reel";
  durationSeconds?: number;
  creativeDirection?: string;
  authorId: string;
  coverHue: number;
  castCharacterIds: string[];
  scenes: NewSceneInput[];
}

interface ChaplinState extends ChaplinWorld {
  currentUserId: string;
  activeRole: AppRole;
  hydrated: boolean;
  setCurrentUser: (userId: string) => void;
  switchDemoRole: (role: AppRole) => void;
  addCharacter: (input: NewCharacterInput) => Character;
  removeCharacter: (characterId: string) => void;
  addStory: (input: NewStoryInput) => Story;
  setCharacterVoice: (characterId: string, voiceId: string) => void;
  addCharacterImage: (characterId: string, imageUrl: string) => void;
  setCharacterVideo: (characterId: string, videoUrl: string) => void;
  hydrateFromStorage: () => void;
}

function persist(state: ChaplinState) {
  if (typeof window === "undefined") return;
  try {
    const snapshot = {
      users: state.users,
      characters: state.characters,
      stories: state.stories,
      castings: state.castings,
      ledger: state.ledger,
      currentUserId: state.currentUserId,
      activeRole: state.activeRole,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    document.cookie = `chaplin-demo-role=${state.activeRole}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // storage full or unavailable, demo still works in-memory
  }
}

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

export const useChaplinStore = create<ChaplinState>((set, get) => ({
  ...SEED_WORLD,
  currentUserId: "u-admin",
  activeRole: "admin",
  hydrated: false,

  setCurrentUser: (userId) => {
    const user = get().users.find((item) => item.id === userId);
    if (!user) return;
    const activeRole = user.roleBadges.includes(get().activeRole)
      ? get().activeRole
      : user.roleBadges[0] ?? "caster";
    set({ currentUserId: userId, activeRole });
    persist(get());
  },

  switchDemoRole: (role) => {
    const preferredUserId: Record<AppRole, string> = {
      maker: "u-meera",
      caster: "u-kabir",
      brand: "u-kabir",
      admin: "u-admin",
    };
    const user = get().users.find((item) => item.id === preferredUserId[role])
      ?? get().users.find((item) => item.roleBadges.includes(role));
    if (!user) return;
    set({ currentUserId: user.id, activeRole: role });
    persist(get());
  },

  addCharacter: (input) => {
    const character: Character = {
      id: nextId("c"),
      makerId: input.makerId,
      name: input.name,
      archetype: input.archetype,
      tagline: input.tagline,
      personality: input.personality,
      voiceGender: input.voiceGender,
      voiceDesc: input.voiceDesc,
      sfxDesc: input.sfxDesc,
      themeDesc: input.themeDesc,
      avatarHue: input.avatarHue,
      licenseType: input.licenseType as LicenseType,
      royaltyRate: input.licenseType === "open" ? 0 : input.royaltyRate,
      createdAt: nowIso(),
      stats: { castings: 0, fans: 40, earnings: 0 },
    };
    set((s) => ({ characters: [character, ...s.characters] }));
    persist(get());
    return character;
  },

  removeCharacter: (characterId) => {
    set((state) => ({ characters: state.characters.filter((character) => character.id !== characterId) }));
    persist(get());
  },

  addStory: (input) => {
    const state = get();
    const storyId = nextId("s");
    const timestamp = nowIso();

    const scenes = input.scenes.map((sc, si) => ({
      id: `${storyId}-sc${si}`,
      setting: sc.setting,
      objective: sc.objective,
      action: sc.action,
      lines: sc.lines.map((ln, li) => ({
        id: `${storyId}-sc${si}-l${li}`,
        characterId: ln.characterId,
        text: ln.text,
        voiceClipMock: {
          durationSec: 2 + ((ln.text.length + li * 3) % 5),
          waveformSeed: (li * 7 + ln.text.length * 3) % 13,
        },
      })),
    }));

    const story: Story = {
      id: storyId,
      authorId: input.authorId,
      title: input.title,
      logline: input.logline,
      format: input.format,
      durationSeconds: input.durationSeconds,
      creativeDirection: input.creativeDirection,
      coverHue: input.coverHue,
      createdAt: timestamp,
      scenes,
      views: 40,
    };

    const newCastings: Casting[] = [];
    const newLedger: LedgerEntry[] = [];

    for (const characterId of input.castCharacterIds) {
      const character = state.characters.find((c) => c.id === characterId);
      if (!character) continue;
      const castingId = nextId("cast");
      const fee = character.licenseType === "open" ? 0 : character.royaltyRate;
      newCastings.push({
        id: castingId,
        characterId,
        storyId,
        casterId: input.authorId,
        timestamp,
        fee,
      });
      if (fee > 0) {
        newLedger.push({
          id: nextId("ledg"),
          castingId,
          characterId,
          storyId,
          makerId: character.makerId,
          amount: fee,
          type: "royalty",
          timestamp,
        });
      }
    }

    set((s) => {
      const updatedCharacters = s.characters.map((c) => {
        const gained = newCastings.filter((cst) => cst.characterId === c.id);
        if (gained.length === 0) return c;
        const earned = newLedger
          .filter((l) => l.characterId === c.id)
          .reduce((sum, l) => sum + l.amount, 0);
        return {
          ...c,
          stats: {
            castings: c.stats.castings + gained.length,
            fans: c.stats.fans + gained.length * 55,
            earnings: c.stats.earnings + earned,
          },
        };
      });
      return {
        stories: [story, ...s.stories],
        castings: [...newCastings, ...s.castings],
        ledger: [...newLedger, ...s.ledger],
        characters: updatedCharacters,
      };
    });

    persist(get());
    return story;
  },


  setCharacterVoice: (characterId, voiceId) => {
    set((s) => ({
      characters: s.characters.map((character) =>
        character.id === characterId ? { ...character, voiceId } : character
      ),
    }));
    persist(get());
  },

  addCharacterImage: (characterId, imageUrl) => {
    set((s) => ({
      characters: s.characters.map((character) =>
        character.id === characterId
          ? {
              ...character,
              imageUrl: character.imageUrl ?? imageUrl,
              galleryUrls: [
                imageUrl,
                ...(character.galleryUrls ?? []).filter((url) => url !== imageUrl),
              ],
            }
          : character
      ),
    }));
    persist(get());
  },

  setCharacterVideo: (characterId, videoUrl) => {
    set((s) => ({
      characters: s.characters.map((character) =>
        character.id === characterId ? { ...character, videoUrl } : character
      ),
    }));
    persist(get());
  },
  hydrateFromStorage: () => {
    if (typeof window === "undefined" || get().hydrated) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.characters)) {
          const currentCharacters = get().characters;
          const currentUsers = get().users;
          const savedUsers = Array.isArray(saved.users) ? saved.users : [];
          const mergedUsers = [
            ...currentUsers.map((current) => ({
              ...current,
              ...(savedUsers.find((savedUser: { id?: string }) => savedUser.id === current.id) ?? {}),
              roleBadges: current.roleBadges,
            })),
            ...savedUsers.filter(
              (savedUser: { id?: string }) => !currentUsers.some((current) => current.id === savedUser.id)
            ),
          ];
          const savedCharacters = saved.characters as Character[];
          const mergedCharacters = [
            ...currentCharacters.map((current) => ({
              ...current,
              ...(savedCharacters.find((savedCharacter) => savedCharacter.id === current.id) ?? {}),
            })),
            ...savedCharacters.filter(
              (savedCharacter) => !currentCharacters.some((current) => current.id === savedCharacter.id)
            ),
          ];
          const requestedUserId = saved.currentUserId ?? get().currentUserId;
          const requestedUser = mergedUsers.find((user) => user.id === requestedUserId);
          const savedRole = (["maker", "caster", "brand", "admin"] as AppRole[]).includes(saved.activeRole)
            ? (saved.activeRole as AppRole)
            : null;
          const activeRole = savedRole && requestedUser?.roleBadges.includes(savedRole)
            ? savedRole
            : requestedUser?.roleBadges[0] ?? get().activeRole;
          set({
            users: mergedUsers,
            characters: mergedCharacters.map((character) => ({
              ...character,
              galleryUrls: character.galleryUrls
                ? [...new Set(character.galleryUrls)]
                : undefined,
              voiceGender:
                character.voiceGender ??
                currentCharacters.find((current) => current.id === character.id)?.voiceGender ??
                "androgynous",
            })),
            stories: saved.stories ?? get().stories,
            castings: saved.castings ?? get().castings,
            ledger: saved.ledger ?? get().ledger,
            currentUserId: requestedUser?.id ?? get().currentUserId,
            activeRole,
          });
        }
      }
    } catch {
      // corrupt storage, fall back to seed silently
    }
    set({ hydrated: true });
    persist(get());
  },
}));
