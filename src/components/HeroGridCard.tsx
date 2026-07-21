"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { motion } from "framer-motion";
import type { Character } from "@/lib/types";
import { ARCHETYPE_LABEL, ARCHETYPE_HUE, hsl } from "@/lib/format";

function pauseAudioRefs(
  dialogueRef: RefObject<HTMLAudioElement | null>,
  themeRef: RefObject<HTMLAudioElement | null>
) {
  dialogueRef.current?.pause();
  themeRef.current?.pause();
}

export type HomepageBroll = {
  characterId: string;
  videoUrl: string | null;
  dialogueUrl: string | null;
  themeUrl: string | null;
};

export default function HeroGridCard({
  character,
  active = false,
  onActivate,
  broll,
  onPlaybackComplete,
}: {
  character: Character;
  active?: boolean;
  onActivate?: () => void;
  broll?: HomepageBroll;
  onPlaybackComplete?: (characterId: string) => void;
}) {
  const hue = ARCHETYPE_HUE[character.archetype];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dialogueRef = useRef<HTMLAudioElement | null>(null);
  const themeRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playingWithSound, setPlayingWithSound] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      pauseAudioRefs(dialogueRef, themeRef);
    };
  }, [active, character.id, broll?.videoUrl]);

  const videoSource = broll?.videoUrl ?? character.videoUrl ?? null;
  const dialogueSource = broll?.dialogueUrl ?? null;
  const themeSource = broll?.themeUrl ?? null;
  const hasSound = Boolean(dialogueSource || themeSource);

  function stopSound() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    dialogueRef.current?.pause();
    themeRef.current?.pause();
    if (videoRef.current) videoRef.current.muted = true;
    setPlayingWithSound(false);
  }

  async function playWithSound() {
    if (playingWithSound) {
      stopSound();
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true;
      await videoRef.current.play().catch(() => undefined);
    }
    if (themeRef.current) {
      themeRef.current.currentTime = 0;
      themeRef.current.volume = 0.22;
      void themeRef.current.play().catch(() => undefined);
    }
    if (dialogueRef.current) {
      dialogueRef.current.currentTime = 0;
      dialogueRef.current.volume = 1;
      void dialogueRef.current.play().catch(() => undefined);
    }
    setPlayingWithSound(true);
    stopTimerRef.current = setTimeout(stopSound, 5500);
  }

  function handleClick(e: React.MouseEvent) {
    // Devices with real hover (mouse/trackpad) always navigate on click, since
    // hovering already previewed the tile. Touch-only devices never fire our
    // onMouseEnter, so there a first tap should preview instead of navigating,
    // and only a second tap (on the now-active tile) goes through.
    const canHover =
      typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
    if (!canHover && !active) {
      e.preventDefault();
      onActivate?.();
    }
  }

  return (
    <motion.div
      layout
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-lg ${active ? "col-span-2 row-span-2" : ""}`}
      data-hero-character-id={character.id}
      style={
        active
          ? { boxShadow: "0 0 36px var(--accent-secondary-glow)" }
          : { boxShadow: "0 0 0 1px var(--line)" }
      }
    >
      {active && <span className="hero-active-border" aria-hidden />}
      {active && videoSource && (
        <span
          className={`broll-progress-border ${progress > 0.92 ? "broll-progress-ending" : ""}`}
          style={{ "--broll-progress": `${Math.max(0, Math.min(1, progress)) * 360}deg` } as CSSProperties}
          aria-hidden
        />
      )}
      <Link
        href={`/characters/${character.id}`}
        onMouseEnter={onActivate}
        onFocus={onActivate}
        onClick={handleClick}
        className="group absolute inset-0 block overflow-hidden rounded-lg"
      >
        <div className="absolute inset-0">
          {character.imageUrl ? (
            <Image
              src={character.imageUrl}
              alt={character.name}
              fill
              sizes="(max-width: 640px) 150px, 260px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${hsl(hue, 60, 22)}, ${hsl(hue, 70, 8)})`,
              }}
            />
          )}
          {active && videoSource && (
            <video
              ref={videoRef}
              src={videoSource}
              autoPlay
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={() => {
                setProgress(0);
                setPlayingWithSound(false);
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                setProgress(video.duration ? video.currentTime / video.duration : 0);
              }}
              onEnded={() => {
                setProgress(1);
                stopSound();
                onPlaybackComplete?.(character.id);
              }}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2">
          <p
            className={`marquee-title uppercase text-ink line-clamp-2 ${
              active
                ? "text-lg sm:text-xl leading-tight"
                : "text-[7.5px] sm:text-[9px] leading-[1.15] tracking-tight"
            }`}
          >
            {character.name}
          </p>
          <p
            className={`text-ink/60 truncate ${active ? "text-xs mt-0.5" : "text-[7px] sm:text-[8px]"}`}
          >
            {ARCHETYPE_LABEL[character.archetype]}
          </p>
        </div>
      </Link>
      {active && (
        <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5" data-home-broll>
          <span className="rounded-full border border-white/25 bg-black/45 px-2 py-1 text-[8px] uppercase tracking-wider text-white/75 backdrop-blur-md">
            B-roll · 5 sec
          </span>
          {hasSound && (
            <button
              type="button"
              onClick={playWithSound}
              aria-label={playingWithSound ? `Mute ${character.name} homepage B-roll` : `Play ${character.name} homepage B-roll with sound`}
              className={`rounded-full border px-2 py-1 text-[8px] font-semibold backdrop-blur-md ${
                playingWithSound ? "border-accent bg-accent text-white" : "border-white/30 bg-black/45 text-white hover:border-accent"
              }`}
            >
              {playingWithSound ? "■ Mute" : "▶ Sound"}
            </button>
          )}
        </div>
      )}
      {active && videoSource && (
        <span className="absolute inset-x-2 bottom-1 z-30 h-0.5 overflow-hidden rounded-full bg-white/20" data-broll-timing-bar>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
      {dialogueSource && <audio ref={dialogueRef} src={dialogueSource} preload="metadata" />}
      {themeSource && <audio ref={themeRef} src={themeSource} preload="metadata" />}
    </motion.div>
  );
}
