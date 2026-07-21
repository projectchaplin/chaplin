"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import type { Character } from "@/lib/types";
import { ARCHETYPE_LABEL, ARCHETYPE_HUE, hsl } from "@/lib/format";

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
  const [progress, setProgress] = useState(0);

  const videoSource = broll?.videoUrl ?? character.videoUrl ?? null;

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
      data-home-video={active && videoSource ? "active" : undefined}
      style={
        active
          ? { boxShadow: "0 0 0 2px var(--accent-secondary), 0 0 28px var(--accent-secondary-glow)" }
          : { boxShadow: "0 0 0 1px var(--line)" }
      }
    >
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
              src={videoSource}
              autoPlay
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={() => {
                setProgress(0);
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                setProgress(video.duration ? video.currentTime / video.duration : 0);
              }}
              onEnded={() => {
                setProgress(1);
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
      {active && videoSource && (
        <span className="absolute inset-x-2 bottom-1 z-30 h-0.5 overflow-hidden rounded-full bg-white/20" data-broll-timing-bar>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </motion.div>
  );
}
