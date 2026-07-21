"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { IconMicrophone, IconMusic, IconWaveform } from "@/components/Icons";

type BrollState = {
  latestVideoUrl: string | null;
  latestDialogueUrl: string | null;
  latestSfxUrl: string | null;
  latestThemeUrl: string | null;
};

type AudioMode = "voice" | "sfx" | "theme";

export default function CharacterBroll({ character }: { character: Character }) {
  const dialogueRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const themeRef = useRef<HTMLAudioElement | null>(null);
  const [production, setProduction] = useState<BrollState | null>(null);
  const [playingMode, setPlayingMode] = useState<AudioMode | null>(null);

  useEffect(() => {
    let cancelled = false;

    function loadBroll() {
      fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`B-roll state returned ${response.status}.`);
          return response.json();
        })
        .then((data: { production?: BrollState | null }) => {
          if (!cancelled) setProduction(data.production ?? null);
        })
        .catch(() => {
          if (!cancelled) setProduction(null);
        });
    }

    function handleMediaUpdated(event: Event) {
      const detail = (event as CustomEvent<{ characterId?: string }>).detail;
      if (detail?.characterId === character.id) loadBroll();
    }

    loadBroll();
    window.addEventListener("chaplin:media-updated", handleMediaUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("chaplin:media-updated", handleMediaUpdated);
    };
  }, [character.id]);

  const videoSource = production?.latestVideoUrl ?? character.videoUrl ?? null;
  const dialogueSource = production?.latestDialogueUrl ?? null;
  const sfxSource = production?.latestSfxUrl ?? null;
  const themeSource = production?.latestThemeUrl ?? null;
  const posterSource = character.bannerUrl ?? character.imageUrl ?? null;

  function stopSound() {
    dialogueRef.current?.pause();
    sfxRef.current?.pause();
    themeRef.current?.pause();
    setPlayingMode(null);
  }

  async function playTrack(mode: AudioMode) {
    if (playingMode === mode) {
      stopSound();
      return;
    }

    stopSound();
    const audio = mode === "voice" ? dialogueRef.current : mode === "sfx" ? sfxRef.current : themeRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = mode === "theme" ? 0.55 : 1;
    await audio.play().catch(() => undefined);
    setPlayingMode(mode);
  }

  const audioControls = [
    { mode: "voice" as const, label: `Hear ${character.name.split(" ")[0]} speak`, shortLabel: "Voice", icon: IconMicrophone, available: Boolean(dialogueSource) },
    { mode: "theme" as const, label: "Listen to the theme", shortLabel: "Theme", icon: IconMusic, available: Boolean(themeSource) },
    { mode: "sfx" as const, label: "Listen to the effects", shortLabel: "Effects", icon: IconWaveform, available: Boolean(sfxSource) },
  ].filter((control) => control.available);

  return (
    <div className="absolute inset-0" data-character-broll>
      {posterSource ? (
        <Image
          src={posterSource}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 896px"
          className={`object-cover object-[68%_center] ${videoSource ? "" : "motion-safe:animate-[broll-drift_8s_ease-in-out_infinite_alternate]"}`}
          priority
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-end pr-[12%] text-[clamp(5rem,18vw,12rem)] font-black text-white/10 motion-safe:animate-[broll-drift_8s_ease-in-out_infinite_alternate]"
          style={{ background: `linear-gradient(135deg, hsl(${character.avatarHue} 35% 18%), #080b02)` }}
          aria-hidden="true"
        >
          {character.name.slice(0, 1)}
        </div>
      )}
      {videoSource && (
        <video
          src={videoSource}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {dialogueSource && <audio ref={dialogueRef} src={dialogueSource} preload="metadata" onEnded={() => setPlayingMode(null)} data-broll-track="voice" />}
      {sfxSource && <audio ref={sfxRef} src={sfxSource} preload="metadata" onEnded={() => setPlayingMode(null)} data-broll-track="sfx" />}
      {themeSource && <audio ref={themeRef} src={themeSource} preload="metadata" onEnded={() => setPlayingMode(null)} data-broll-track="theme" />}

      <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 sm:via-black/45 to-transparent" />
      {audioControls.length > 0 && (
        <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 sm:right-5" data-broll-audio-controls>
          {audioControls.map(({ mode, label, shortLabel, icon: Icon }) => {
            const active = playingMode === mode;
            return (
              <div key={mode} className="group relative flex justify-end">
                <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-2.5 py-1 text-[9px] font-medium text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {active ? "Pause" : label}
                </span>
                <button
                  type="button"
                  onClick={() => playTrack(mode)}
                  aria-label={active ? `Pause ${label.toLowerCase()}` : label}
                  data-audio-mode={mode}
                  className={`flex h-9 items-center justify-center gap-2 rounded-full border px-2.5 shadow-lg backdrop-blur-md transition-all sm:h-10 sm:px-3 ${
                    active
                      ? "scale-105 border-accent bg-accent text-white"
                      : "border-white/30 bg-black/45 text-white/85 hover:scale-105 hover:border-accent hover:bg-black/70 hover:text-white"
                  }`}
                >
                  {active ? <span className="text-xs">Ⅱ</span> : <Icon className="h-4 w-4" />}
                  <span className="hidden text-[10px] font-semibold sm:inline">{active ? "Pause" : shortLabel}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
