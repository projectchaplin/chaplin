"use client";

import { useState } from "react";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import {
  recentStories,
  availableForCasting,
  topCharactersByEarnings,
  castForStory,
  getUser,
  charactersByMaker,
} from "@/lib/selectors";
import CharacterCard from "@/components/CharacterCard";
import PosterCard from "@/components/PosterCard";
import Carousel from "@/components/Carousel";
import HeroGridCard from "@/components/HeroGridCard";
import SectionHeading from "@/components/SectionHeading";
import Avatar from "@/components/Avatar";
import { IconMask, IconFilm, IconTrophy } from "@/components/Icons";
import { compactNumber, money } from "@/lib/format";

export default function HomePage() {
  const world = useChaplinStore((s) => s);
  const audience = world.activeRole === "maker" ? "maker" : "caster";
  const isMaker = audience === "maker";

  const hero = isMaker
    ? {
        eyebrow: "Build. Own. Earn.",
        heading: (
          <>
            CREATE AND MONETIZE
            <br />
            AI CHARACTERS
          </>
        ),
        description:
          "Build original AI actors with a consistent identity, voice, SFX, images, and video. Publish them for casting and earn every time they perform.",
        primary: { href: "/characters/new", label: "Create an AI Actor" },
        secondary: { href: "/studio", label: "Open Maker Studio" },
        tertiary: { href: "/ledger", label: "See how royalties work" },
      }
    : {
        eyebrow: "Discover. Cast. Create.",
        heading: (
          <>
            CASTING FOR
            <br />
            AI ACTORS
          </>
        ),
        description:
          "Discover production-ready AI actors with consistent voices and visual identities. Cast them into your story, scene, campaign, or film.",
        primary: { href: "/characters", label: "Browse AI Characters" },
        secondary: { href: "/studio/write", label: "Create a Casting" },
        tertiary: { href: "/stories", label: "See stories in production" },
      };

  const stories = recentStories(world, 6);
  const shelfPicks = availableForCasting(world, 8);
  const topEarners = topCharactersByEarnings(world, 5);

  const totalCastings = world.castings.length;
  const totalPaidOut = world.ledger.reduce((sum, l) => sum + l.amount, 0);

  const featured = topEarners[0];
  const restChars = world.characters.filter((c) => c.id !== featured?.id);
  const gridChars = featured
    ? [...restChars.slice(0, 4), featured, ...restChars.slice(4)]
    : world.characters;
  const liveAvatars = world.characters.slice(0, 6);

  const [activeGridId, setActiveGridId] = useState<string | null>(null);
  const currentFeaturedId = activeGridId ?? featured?.id;

  // The featured tile eats 4 cells (2x2) instead of 1, so a 4-column grid can
  // land short of a full row. Fill the remainder with CTA tiles instead of
  // leaving a gap.
  const gridColumns = 4;
  const occupiedCells = gridChars.length + 3; // +3 because the featured tile costs 4, not 1
  const fillerCount = (gridColumns - (occupiedCells % gridColumns)) % gridColumns;

  const STATS = [
    { label: "Characters on the shelf", value: `${world.characters.length}` },
    { label: "Stories performed", value: `${world.stories.length}` },
    { label: "Castings made", value: `${totalCastings}` },
    { label: "Royalties paid to makers", value: `${compactNumber(totalPaidOut)}` },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-5 flex justify-end">
              <div
                className="grid grid-cols-2 gap-1 rounded-md border border-line bg-paper-dim p-1 w-full max-w-[19rem] ml-auto"
                aria-label="Choose how you want to use Chaplin"
              >
                <button
                  type="button"
                  aria-pressed={!isMaker}
                  onClick={() => world.switchDemoRole("caster")}
                  className={`rounded px-3 py-1.5 text-left transition-colors ${!isMaker ? "bg-accent text-paper shadow-sm" : "text-grey hover:text-ink"}`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em]">Caster</span>
                  <span className={`block text-[9px] mt-0.5 ${!isMaker ? "text-paper/75" : "text-grey"}`}>Cast a character</span>
                </button>
                <button
                  type="button"
                  aria-pressed={isMaker}
                  onClick={() => world.switchDemoRole("maker")}
                  className={`rounded px-3 py-1.5 text-left transition-colors ${isMaker ? "bg-accent text-paper shadow-sm" : "text-grey hover:text-ink"}`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em]">Maker</span>
                  <span className={`block text-[9px] mt-0.5 ${isMaker ? "text-paper/75" : "text-grey"}`}>Make and monetize</span>
                </button>
              </div>
            </div>

            {/* Copy */}
            <div className="lg:col-span-2 min-w-0">
              <p className="accent-text text-xs uppercase tracking-[0.3em] mb-4 font-semibold">
                {hero.eyebrow}
              </p>
              <h1 className={`marquee-title leading-none mb-5 break-words ${isMaker ? "text-4xl sm:text-5xl" : "text-4xl sm:text-6xl"}`}>
                {hero.heading}
              </h1>
              <p className="text-sm sm:text-base text-grey mb-7 max-w-md">
                {hero.description}
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <Link
                  href={hero.primary.href}
                  className="accent-btn font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity"
                >
                  {hero.primary.label}
                </Link>
                <Link
                  href={hero.secondary.href}
                  className="border border-line px-6 py-2.5 rounded-full hover:border-accent hover:text-accent-light transition-colors"
                >
                  {hero.secondary.label}
                </Link>
              </div>
              <Link
                href={hero.tertiary.href}
                className="text-sm text-grey hover:text-accent inline-flex items-center gap-1 mb-8"
              >
                {hero.tertiary.label} <span aria-hidden>→</span>
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 poster-card rounded-md p-4">
                <div className="min-w-0">
                  <IconMask className="w-5 h-5 text-accent mb-1.5" />
                  <p className="text-xs font-semibold">{isMaker ? "Build Identity" : "Discover Talent"}</p>
                  <p className="text-[10px] text-grey leading-snug">
                    {isMaker ? "Create and own original AI actors" : "Find production-ready AI actors"}
                  </p>
                </div>
                <div className="min-w-0">
                  <IconFilm className="w-5 h-5 text-accent mb-1.5" />
                  <p className="text-xs font-semibold">{isMaker ? "Produce Assets" : "Cast Into Stories"}</p>
                  <p className="text-[10px] text-grey leading-snug">
                    {isMaker ? "Voice, SFX, images, and video" : "Build scenes with consistent talent"}
                  </p>
                </div>
                <div className="min-w-0">
                  <IconTrophy className="w-5 h-5 text-accent mb-1.5" />
                  <p className="text-xs font-semibold">{isMaker ? "Earn Royalties" : "Clear Licensing"}</p>
                  <p className="text-[10px] text-grey leading-snug">
                    {isMaker ? "Monetize every performance" : "Know the terms before you cast"}
                  </p>
                </div>
              </div>
            </div>

            {/* Character grid: hover (or first tap on touch) makes any tile the big one */}
            <div className="lg:col-span-3">
              <div
                className="grid grid-cols-4 auto-rows-[76px] sm:auto-rows-[92px] lg:auto-rows-[112px] gap-2 grid-flow-dense"
                onMouseLeave={() => setActiveGridId(null)}
              >
                {gridChars.map((c) => (
                  <HeroGridCard
                    key={c.id}
                    character={c}
                    active={c.id === currentFeaturedId}
                    onActivate={() => setActiveGridId(c.id)}
                  />
                ))}
                {Array.from({ length: fillerCount }).map((_, i) => (
                  <Link
                    key={`filler-${i}`}
                    href={isMaker ? "/characters/new" : "/characters"}
                    className="rounded-lg border border-dashed border-line flex flex-col items-center justify-center gap-1 text-grey hover:border-accent hover:text-accent transition-colors p-2 text-center"
                  >
                    <span className="text-lg leading-none">{isMaker ? "+" : "→"}</span>
                    <span className="text-[8px] sm:text-[9px] leading-tight">
                      {isMaker ? "Create a Character" : "Browse all actors"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Stat bar + live now */}
          <div className="mt-10 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
              {STATS.map((s) => (
                <span key={s.label} className="text-center sm:text-left">
                  <b className="marquee-title text-2xl block accent-text">{s.value}</b>
                  {s.label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-xs text-grey">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Live Now
              </span>
              <div className="flex -space-x-2">
                {liveAvatars.map((c) => (
                  <span key={c.id} className="ring-2 ring-paper rounded-full">
                    <Avatar hue={c.avatarHue} label={c.name} src={c.imageUrl} size={26} />
                  </span>
                ))}
                {world.characters.length > liveAvatars.length && (
                  <span className="ring-2 ring-paper rounded-full w-[26px] h-[26px] flex items-center justify-center bg-paper-dim text-[10px] text-grey">
                    +{world.characters.length - liveAvatars.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-grey hidden sm:inline">
                {world.characters.length} characters ready to cast
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Now showing */}
      <section className="max-w-6xl mx-auto px-6 py-12 w-full">
        <SectionHeading eyebrow="Now Showing" title="Stories performing right now" href="/stories" />
        <Carousel>
          {stories.map((story, i) => {
            const cast = castForStory(world, story.id).map((r) => r.character);
            const author = getUser(world, story.authorId);
            return (
              <PosterCard
                key={story.id}
                story={story}
                cast={cast}
                authorName={author?.name}
                isNew={i === 0}
              />
            );
          })}
        </Carousel>
      </section>

      {/* Available for casting */}
      <section className="max-w-6xl mx-auto px-6 py-12 w-full">
        <SectionHeading
          eyebrow="The Shelf"
          title="Available for casting"
          href="/characters"
          hrefLabel="Browse all"
        />
        <Carousel>
          {shelfPicks.map((character) => {
            const maker = getUser(world, character.makerId);
            return (
              <div key={character.id} className="w-64 shrink-0 snap-start">
                <CharacterCard character={character} makerName={maker?.name} />
              </div>
            );
          })}
        </Carousel>
      </section>

      {/* Top earning performers */}
      <section className="max-w-6xl mx-auto px-6 py-12 w-full">
        <SectionHeading
          eyebrow="The Star System"
          title="Top-earning performers"
          href="/ledger"
          hrefLabel="Full leaderboard"
        />
        <div className="poster-card rounded-md divide-y divide-line">
          {topEarners.map((character, i) => {
            const maker = getUser(world, character.makerId);
            const makerCharCount = charactersByMaker(world, character.makerId).length;
            return (
              <Link
                key={character.id}
                href={`/characters/${character.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-paper transition-colors"
              >
                <span className="marquee-title text-2xl text-accent w-8 text-center">
                  {i + 1}
                </span>
                <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{character.name}</p>
                  <p className="text-xs text-grey truncate">
                    made by {maker?.name} · {makerCharCount} character
                    {makerCharCount === 1 ? "" : "s"} on the shelf
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-accent font-semibold text-sm">{money(character.stats.earnings)}</p>
                  <p className="text-xs text-grey">
                    {character.stats.castings} castings · {compactNumber(character.stats.fans)} fans
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
