"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import HeroGridCard, { type HomepageBroll } from "@/components/HeroGridCard";

const CASTING_FORMATS = ["Reels", "Ads", "Micro Drama", "UGC"];

export default function InfiniteCharacterGallery() {
  const characters = useChaplinStore((state) => state.characters);
  const [castingFormatIndex, setCastingFormatIndex] = useState(0);
  const [activeGridId, setActiveGridId] = useState<string | null>(null);
  const [automaticGridId, setAutomaticGridId] = useState<string | null>(null);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const brollByCharacter = useMemo(
    () => new Map(brolls.map((broll) => [broll.characterId, broll])),
    [brolls],
  );
  const readyBrollIds = useMemo(
    () => characters
      .filter((character) => brollByCharacter.get(character.id)?.videoUrl || character.videoUrl)
      .map((character) => character.id),
    [brollByCharacter, characters],
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
      void fetch("/api/broll", { cache: "no-store" })
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

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !readyBrollIds.length) return;
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);

      if (activeGridId) {
        const activeVisible = [...ratios.entries()].some(
          ([element, ratio]) =>
            (element as HTMLElement).dataset.heroCharacterId === activeGridId && ratio >= 0.28,
        );
        if (!activeVisible) setActiveGridId(null);
      }

      const best = [...ratios.entries()]
        .filter(([, ratio]) => ratio >= 0.58)
        .sort((a, b) => b[1] - a[1])
        .map(([element]) => (element as HTMLElement).dataset.heroCharacterId)
        .find((id): id is string => Boolean(id && readyBrollIds.includes(id)));
      if (best) setAutomaticGridId((current) => current === best ? current : best);
    }, {
      rootMargin: "-16% 0px -22% 0px",
      threshold: [0, 0.28, 0.58, 0.78, 0.95],
    });

    const cards = grid.querySelectorAll<HTMLElement>("[data-home-video-ready='true']");
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [activeGridId, readyBrollIds]);

  function advanceBroll(completedCharacterId: string) {
    if (readyBrollIds.length < 2) return;
    const currentIndex = readyBrollIds.indexOf(completedCharacterId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % readyBrollIds.length;
    setActiveGridId(null);
    setAutomaticGridId(readyBrollIds[nextIndex]);
  }

  if (!characters.length) return null;

  return (
    <main className="relative min-h-[calc(100svh-4rem)] overflow-x-clip pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(242,78,112,0.12),transparent_28%),radial-gradient(circle_at_78%_16%,rgba(7,210,190,0.14),transparent_27%)]" />
      <section className="relative mx-auto w-full max-w-6xl px-4 py-6 lg:px-6 lg:py-10" aria-label="AI actor gallery">
        <div className="mx-auto mb-6 max-w-3xl text-center lg:mb-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-accent">The Chaplin cast</p>
          <h1 className="marquee-title mt-2 text-[clamp(2.25rem,9vw,5rem)] uppercase leading-[0.92] text-ink">
            The World of AI Actors
          </h1>
          <p className="mt-3 text-sm leading-6 text-grey sm:text-xl sm:leading-8" aria-live="polite">
            Ready to cast AI actors for{" "}
            <span
              key={CASTING_FORMATS[castingFormatIndex]}
              className="font-semibold text-accent motion-safe:animate-[chaplin-format-enter_400ms_ease-out]"
            >
              {CASTING_FORMATS[castingFormatIndex]}.
            </span>
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/35">
            Scroll to preview · tap once to play · tap again to open
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
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
          <Link
            href="/characters/new"
            className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-3 text-center text-grey transition-colors hover:border-accent hover:text-accent"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[11px] font-semibold leading-tight">Create your AI actor</span>
          </Link>
        </div>

        <div className="mx-auto mt-7 flex w-full items-center justify-between gap-4 lg:mt-10">
          <p className="text-xs text-grey">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-secondary shadow-[0_0_10px_var(--accent-secondary)]" />
            {characters.length} characters ready to discover
          </p>
          <Link
            href="/feed"
            className="rounded-full border border-line bg-paper/65 px-5 py-2.5 text-xs font-semibold text-ink backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
          >
            Open Feed →
          </Link>
        </div>
      </section>
    </main>
  );
}
