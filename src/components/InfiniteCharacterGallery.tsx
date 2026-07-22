"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import HeroGridCard, { type HomepageBroll } from "@/components/HeroGridCard";

const CASTING_FORMATS = ["Reels", "Ads", "Micro Drama", "UGC"];

export default function InfiniteCharacterGallery() {
  const characters = useChaplinStore((state) => state.characters);
  const [castingFormatIndex, setCastingFormatIndex] = useState(0);
  const [activeGridId, setActiveGridId] = useState<string | null>(null);
  const [automaticGridId, setAutomaticGridId] = useState<string | null>(null);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);

  const brollByCharacter = useMemo(
    () => new Map(brolls.map((broll) => [broll.characterId, broll])),
    [brolls]
  );
  const readyBrollIds = useMemo(
    () => characters.filter((character) => brollByCharacter.get(character.id)?.videoUrl || character.videoUrl).map((character) => character.id),
    [brollByCharacter, characters]
  );
  const validAutomaticGridId = automaticGridId && readyBrollIds.includes(automaticGridId)
    ? automaticGridId
    : null;
  const currentFeaturedId = activeGridId ?? validAutomaticGridId ?? readyBrollIds[0] ?? characters[0]?.id;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCastingFormatIndex((current) => (current + 1) % CASTING_FORMATS.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function loadBrolls() {
      fetch("/api/broll", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`B-roll manifest returned ${response.status}.`);
          return response.json();
        })
        .then((data: { characters?: HomepageBroll[] }) => {
          if (!cancelled) setBrolls(data.characters ?? []);
        })
        .catch(() => {
          if (!cancelled) setBrolls([]);
        });
    }

    loadBrolls();
    window.addEventListener("chaplin:media-updated", loadBrolls);
    return () => {
      cancelled = true;
      window.removeEventListener("chaplin:media-updated", loadBrolls);
    };
  }, []);

  function advanceBroll(completedCharacterId: string) {
    if (readyBrollIds.length < 2) return;
    const currentIndex = readyBrollIds.indexOf(completedCharacterId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % readyBrollIds.length;
    setActiveGridId(null);
    setAutomaticGridId(readyBrollIds[nextIndex]);
  }

  if (!characters.length) return null;

  // The expanded tile costs 4 cells (2x2) instead of 1, so the last row can land
  // short. Pad the grid to a multiple of 8 — that also divides evenly at 4 cols,
  // so the same filler tiles complete both breakpoints. One cell is the create
  // CTA; the rest repeat actors so the page always feels completely filled.
  const occupiedCells = characters.length + 3;
  const leftover = (8 - (occupiedCells % 8)) % 8;
  const extraCount = leftover === 0 ? 8 : leftover;
  const repeatedCharacters = Array.from(
    { length: Math.max(0, extraCount - 1) },
    (_, index) => characters[index % characters.length]
  );

  return (
    <main className="relative flex h-[calc(100dvh-10rem)] flex-col overflow-hidden lg:block lg:h-auto lg:min-h-[calc(100svh-4rem)] lg:pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_42%,rgba(242,78,112,0.12),transparent_27%),radial-gradient(circle_at_76%_22%,rgba(7,210,190,0.14),transparent_25%)]" />
      <section className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 py-4 lg:block lg:h-auto lg:px-6 lg:py-8" aria-label="AI actor gallery">
        {/* Heading: centered; the rotating word is plain inline text so it can never wrap alone */}
        <div className="mx-auto mb-4 max-w-3xl shrink-0 text-center lg:mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-accent">The Chaplin cast</p>
          <h1 className="marquee-title mt-2 text-4xl uppercase leading-none text-ink sm:text-6xl">
            The World of AI Actors
          </h1>
          <p className="mt-3 whitespace-nowrap text-sm leading-6 text-grey sm:text-2xl sm:leading-9" aria-live="polite">
            Ready to cast AI actors for{" "}
            <span key={CASTING_FORMATS[castingFormatIndex]} className="font-semibold text-accent motion-safe:animate-[chaplin-format-enter_400ms_ease-out]">
              {CASTING_FORMATS[castingFormatIndex]}.
            </span>
          </p>
        </div>

        {/* Grid: fixed 4 cols (mobile) / 8 cols (desktop) so the fill math below is exact.
            Hover (or first tap on touch) expands any tile to 2x2 and plays its b-roll. */}
        <div
          className="grid min-h-0 flex-1 grid-flow-dense grid-cols-4 auto-rows-[minmax(0,1fr)] gap-1.5 lg:flex-none lg:grid-cols-8 lg:auto-rows-[124px] lg:gap-2"
          onMouseLeave={() => setActiveGridId(null)}
        >
          {characters.map((character) => (
            <HeroGridCard
              key={character.id}
              character={character}
              active={character.id === currentFeaturedId}
              onActivate={() => setActiveGridId(character.id)}
              broll={brollByCharacter.get(character.id)}
              onPlaybackComplete={advanceBroll}
            />
          ))}
          {repeatedCharacters.map((character, index) => (
            <HeroGridCard
              key={`repeat-${character.id}-${index}`}
              character={character}
              active={false}
              onActivate={() => setActiveGridId(character.id)}
              broll={brollByCharacter.get(character.id)}
            />
          ))}
          <Link
            href="/characters/new"
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line p-2 text-center text-grey transition-colors hover:border-accent hover:text-accent"
          >
            <span className="text-xl leading-none">+</span>
            <span className="text-[10px] font-semibold leading-tight sm:text-[11px]">Create your AI actor</span>
          </Link>
        </div>

        <div className="mx-auto mt-3 flex w-full shrink-0 items-center justify-between gap-4 lg:mt-10">
          <p className="text-xs text-grey"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-secondary shadow-[0_0_10px_var(--accent-secondary)]" />{characters.length} characters ready to discover</p>
          <Link href="/feed" className="rounded-full border border-line bg-paper/65 px-5 py-2.5 text-xs font-semibold text-ink backdrop-blur-md transition-colors hover:border-accent hover:text-accent">Open Feed →</Link>
        </div>
      </section>
    </main>
  );
}
