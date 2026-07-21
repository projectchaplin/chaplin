"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/types";
import MediaPlayer from "@/components/MediaPlayer";

type SoundState = {
  voicePreviewUrl: string | null;
  latestDialogueUrl: string | null;
  latestSfxUrl: string | null;
  latestThemeUrl: string | null;
};

type TrackKind = "voice" | "sfx" | "music";

export default function CharacterHeroAudio({ character }: { character: Character }) {
  const [sounds, setSounds] = useState<SoundState | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<TrackKind>("voice");

  useEffect(() => {
    let cancelled = false;

    function loadSounds() {
      setFailed(false);
      fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`Hero audio returned ${response.status}.`);
          return response.json();
        })
        .then((data: { production?: SoundState | null }) => {
          if (!cancelled) setSounds(data.production ?? null);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }

    function handleMediaUpdated(event: Event) {
      const detail = (event as CustomEvent<{ characterId?: string }>).detail;
      if (detail?.characterId === character.id) loadSounds();
    }

    loadSounds();
    window.addEventListener("chaplin:media-updated", handleMediaUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("chaplin:media-updated", handleMediaUpdated);
    };
  }, [character.id]);

  const tracks = useMemo(
    () => ({
      voice: {
        label: `${character.name.split(" ")[0]}'s voice`,
        src: sounds?.latestDialogueUrl ?? sounds?.voicePreviewUrl ?? null,
      },
      sfx: { label: "Signature SFX", src: sounds?.latestSfxUrl ?? null },
      music: { label: "Theme music", src: sounds?.latestThemeUrl ?? null },
    }),
    [character.name, sounds]
  );

  const availableTracks = (Object.entries(tracks) as [TrackKind, (typeof tracks)[TrackKind]][]).filter(
    ([, track]) => Boolean(track.src)
  );
  const activeTrack = tracks[selected].src ? tracks[selected] : availableTracks[0]?.[1];

  if (!sounds && !failed) {
    return <div className="mt-2 h-[74px] w-full max-w-md animate-pulse rounded-md border border-white/15 bg-black/30" aria-label="Loading actor audio" />;
  }

  if (!activeTrack?.src) {
    return (
      <a href="#sound-profile" className="mt-2 self-start inline-flex items-center gap-2 rounded-full border border-accent/60 bg-black/35 px-3 py-1.5 text-xs text-accent backdrop-blur-md hover:bg-accent/10">
        View sound profile
      </a>
    );
  }

  return (
    <div className="mt-2 w-full max-w-md rounded-md border border-white/20 bg-black/55 p-1.5 text-white shadow-xl backdrop-blur-md" data-hero-audio-player>
      <div className="mb-1.5 flex items-center gap-1 overflow-x-auto scrollbar-thin" aria-label={`${character.name} audio tracks`}>
        {availableTracks.map(([kind]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setSelected(kind)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              selected === kind ? "bg-accent text-white" : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
            }`}
          >
            {kind === "music" ? "Music" : kind.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto hidden text-[8px] uppercase tracking-[0.14em] text-white/45 sm:block">Live audio</span>
      </div>
      <MediaPlayer key={`${selected}-${activeTrack.src}`} src={activeTrack.src} label={activeTrack.label} compact />
    </div>
  );
}
