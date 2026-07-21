"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/types";

type BrollState = {
  latestVideoUrl: string | null;
  latestDialogueUrl: string | null;
  latestThemeUrl: string | null;
};

export default function CharacterBroll({ character }: { character: Character }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dialogueRef = useRef<HTMLAudioElement | null>(null);
  const themeRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [production, setProduction] = useState<BrollState | null>(null);
  const [playingWithSound, setPlayingWithSound] = useState(false);

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
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      window.removeEventListener("chaplin:media-updated", handleMediaUpdated);
    };
  }, [character.id]);

  const videoSource = production?.latestVideoUrl ?? character.videoUrl ?? null;
  const dialogueSource = production?.latestDialogueUrl ?? null;
  const themeSource = production?.latestThemeUrl ?? null;
  const posterSource = character.bannerUrl ?? character.imageUrl ?? null;
  const hasSound = Boolean(dialogueSource || themeSource);

  function stopSound() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    dialogueRef.current?.pause();
    themeRef.current?.pause();
    if (videoRef.current) videoRef.current.muted = true;
    setPlayingWithSound(false);
  }

  async function playBroll() {
    if (playingWithSound) {
      stopSound();
      return;
    }

    const video = videoRef.current;
    const dialogue = dialogueRef.current;
    const theme = themeRef.current;
    if (video) {
      video.currentTime = 0;
      video.muted = true;
      await video.play().catch(() => undefined);
    }
    if (theme) {
      theme.currentTime = 0;
      theme.volume = 0.24;
      await theme.play().catch(() => undefined);
    }
    if (dialogue) {
      dialogue.currentTime = 0;
      dialogue.volume = 1;
      await dialogue.play().catch(() => undefined);
    }
    setPlayingWithSound(true);
    stopTimerRef.current = setTimeout(stopSound, 5500);
  }

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
          ref={videoRef}
          src={videoSource}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {dialogueSource && <audio ref={dialogueRef} src={dialogueSource} preload="metadata" />}
      {themeSource && <audio ref={themeRef} src={themeSource} preload="metadata" />}

      <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 sm:via-black/45 to-transparent" />
      <div className="absolute right-3 top-3 sm:right-5 sm:top-5 z-20 flex items-center gap-2">
        <span className="rounded-full border border-white/25 bg-black/35 backdrop-blur-md px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white/75">
          B-roll · 5 sec
        </span>
        {hasSound && (
          <button
            type="button"
            onClick={playBroll}
            aria-label={playingWithSound ? `Mute ${character.name} b-roll` : `Play ${character.name} b-roll with sound`}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold backdrop-blur-md transition-colors ${
              playingWithSound ? "border-accent bg-accent text-white" : "border-white/35 bg-black/35 text-white hover:border-accent"
            }`}
          >
            {playingWithSound ? "■ Mute" : "▶ Play with sound"}
          </button>
        )}
      </div>
    </div>
  );
}
