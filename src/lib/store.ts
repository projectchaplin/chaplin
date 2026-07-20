"use client";

import { create } from "zustand";
import { SEED_WORLD } from "@/data/seed";
import type {
  Character,
  Story,
  Casting,
  LedgerEntry,
  ChaplinWorld,
  LicenseType,
} from "@/lib/types";

const STORAGE_KEY = "chaplin:v11";

export type NewCharacterInput = Pick<
  Character,
  | "name"
  | "archetype"
  | "tagline"
  | "personality"
  | "voiceDesc"
  | "sfxDesc"
  | "themeDesc"
  | "licenseType"
  | "royaltyRate"
  | "avatarHue"
> & { makerId: string };

export interface NewSceneInput {
  setting: string;
  lines: Array<{ characterId: string; text: string }>;
}

export interface NewStoryInput {
  title: string;
  logline: string;
  authorId: string;
  coverHue: number;
  castCharacterIds: string[];
  scenes: NewSceneInput[];
}

interface ChaplinState extends ChaplinWorld {
  currentUserId: string;
  hydrated: boolean;
  setCurrentUser: (userId: string) => void;
  addCharacter: (input: NewCharacterInput) => Character;
  addStory: (input: NewStoryInput) => Story;
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
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // storage full or unavailable, demo still works in-memory
  }
}

let idCounter = 1000;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function nowIso() {
  return new Date().toISOString();
}

export const useChaplinStore = create<ChaplinState>((set, get) => ({
  ...SEED_WORLD,
  currentUserId: "u-arjun",
  hydrated: false,

  setCurrentUser: (userId) => {
    set({ currentUserId: userId });
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

  addStory: (input) => {
    const state = get();
    const storyId = nextId("s");
    const timestamp = nowIso();

    const scenes = input.scenes.map((sc, si) => ({
      id: `${storyId}-sc${si}`,
      setting: sc.setting,
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

  hydrateFromStorage: () => {
    if (typeof window === "undefined" || get().hydrated) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.characters)) {
          set({
            users: saved.users ?? get().users,
            characters: saved.characters,
            stories: saved.stories ?? get().stories,
            castings: saved.castings ?? get().castings,
            ledger: saved.ledger ?? get().ledger,
            currentUserId: saved.currentUserId ?? get().currentUserId,
          });
        }
      }
    } catch {
      // corrupt storage, fall back to seed silently
    }
    set({ hydrated: true });
  },
}));
