"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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
  const artworkSource = character.imageUrl ?? character.bannerUrl ?? character.galleryUrls?.[0] ?? null;

  function activateInPlace() {
    onActivate?.();
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
      activateInPlace();
    }
  }

  return (
    <div
      className={`relative rounded-lg transition-shadow duration-300 ${active ? "z-10 col-span-2 row-span-2" : "z-0"}`}
      data-hero-character-id={character.id}
      data-home-video={active && videoSource ? "active" : undefined}
      style={
        active
          ? { boxShadow: "0 0 0 1px var(--accent-secondary), 0 0 12px var(--accent-secondary-glow)" }
          : { boxShadow: "0 0 0 1px var(--line)" }
      }
    >
      <Link
        href={`/characters/${character.id}`}
        onMouseEnter={activateInPlace}
        onFocus={activateInPlace}
        onClick={handleClick}
        className="group absolute inset-0 block overflow-hidden rounded-lg"
      >
        <div className="absolute inset-0">
          {artworkSource ? (
            <Image
              src={artworkSource}
              alt={character.name}
              fill
              quality={90}
              sizes={active ? "(max-width: 640px) 100vw, 480px" : "(max-width: 640px) 200px, 320px"}
              className="object-cover"
              data-hero-artwork
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
        <div className={`absolute bottom-0 left-0 right-0 ${active ? "p-3" : "p-1.5 sm:p-2"}`}>
          <p className={`marquee-title line-clamp-2 uppercase leading-[1.15] tracking-tight text-ink ${active ? "text-sm sm:text-base" : "text-[7.5px] sm:text-[9px]"}`}>
            {character.name}
          </p>
          <p className={`truncate text-ink/60 ${active ? "mt-0.5 text-xs" : "text-[7px] sm:text-[8px]"}`}>
            {ARCHETYPE_LABEL[character.archetype]}
          </p>
        </div>
      </Link>
      {active && videoSource && (
        <span className="absolute inset-x-2 bottom-1 z-30 h-0.5 overflow-hidden rounded-full bg-white/20" data-broll-timing-bar>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </div>
  );
}
