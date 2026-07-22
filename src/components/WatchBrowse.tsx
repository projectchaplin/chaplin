"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import { castForStory, getUser } from "@/lib/selectors";
import Carousel from "@/components/Carousel";
import PosterCard from "@/components/PosterCard";
import type { HomepageBroll } from "@/components/HeroGridCard";
import type { SeriesSummary } from "@/lib/series-types";
import type { Character } from "@/lib/types";
import { ARCHETYPE_LABEL, hsl } from "@/lib/format";

function SparkCard({ character, videoUrl }: { character: Character; videoUrl: string }) {
  const [hovering, setHovering] = useState(false);
  const poster = character.imageUrl ?? character.bannerUrl ?? character.galleryUrls?.[0];

  return (
    <Link
      href={`/characters/${character.id}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="group relative w-40 shrink-0 snap-start overflow-hidden rounded-md border border-line aspect-[9/14] transition-transform duration-200 hover:z-10 hover:scale-[1.05] hover:shadow-xl sm:w-44"
    >
      {poster ? (
        <Image src={poster} alt={character.name} fill quality={90} sizes="176px" className="object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${hsl(character.avatarHue, 60, 24)}, ${hsl(character.avatarHue, 70, 8)})` }} />
      )}
      {hovering && (
        <video src={videoUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="marquee-title truncate text-[11px] uppercase text-white">{character.name}</p>
        <p className="mt-0.5 truncate text-[9px] text-white/60">{ARCHETYPE_LABEL[character.archetype]} · 5s spark</p>
      </div>
    </Link>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="marquee-title text-lg uppercase tracking-wide sm:text-xl">{title}</h2>
        {hint && <p className="hidden text-[11px] text-grey sm:block">{hint}</p>}
      </div>
      <Carousel>{children}</Carousel>
    </section>
  );
}

export default function WatchBrowse({ series }: { series: SeriesSummary[] }) {
  const world = useChaplinStore((state) => state);
  const [brolls, setBrolls] = useState<HomepageBroll[]>([]);

  useEffect(() => {
    fetch("/api/broll", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { characters: [] }))
      .then((data: { characters?: HomepageBroll[] }) => setBrolls(data.characters ?? []))
      .catch(() => setBrolls([]));
  }, []);

  const brollByCharacter = useMemo(() => new Map(brolls.map((b) => [b.characterId, b])), [brolls]);

  const stories = world.stories.filter((story) => (story.format ?? "story") === "story");
  const adsAndReels = world.stories.filter((story) => story.format === "ad" || story.format === "reel");
  const sparks = world.characters
    .map((character) => ({ character, videoUrl: brollByCharacter.get(character.id)?.videoUrl ?? character.videoUrl ?? null }))
    .filter((entry): entry is { character: Character; videoUrl: string } => Boolean(entry.videoUrl));

  const heroEntry = sparks[0];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6">
      {/* Hero: the top spark playing full-bleed, Netflix-style */}
      {heroEntry && (
        <section className="relative mb-10 overflow-hidden rounded-2xl border border-line">
          <div className="relative aspect-[16/7] min-h-56 w-full">
            <video
              src={heroEntry.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              poster={heroEntry.character.imageUrl ?? undefined}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">Now performing</p>
              <h1 className="marquee-title mt-1.5 text-3xl uppercase text-white sm:text-5xl">{heroEntry.character.name}</h1>
              <p className="mt-1.5 max-w-xl text-xs leading-5 text-white/75 sm:text-sm">{heroEntry.character.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/characters/${heroEntry.character.id}`} className="accent-btn rounded-full px-5 py-2 text-xs font-semibold sm:text-sm">
                  Open profile
                </Link>
                <Link href="/feed" className="rounded-full border border-white/30 bg-black/40 px-5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:border-accent sm:text-sm">
                  Watch in feed
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {stories.length > 0 && (
        <Row title="Top stories" hint="Serialised castings with full scenes and cliffhangers">
          {stories.map((story) => (
            <PosterCard key={story.id} story={story} cast={castForStory(world, story.id).map((entry) => entry.character)} authorName={getUser(world, story.authorId)?.name} />
          ))}
        </Row>
      )}

      {sparks.length > 0 && (
        <Row title="Top sparks" hint="Five-second auditions — hover to play">
          {sparks.map(({ character, videoUrl }) => (
            <SparkCard key={character.id} character={character} videoUrl={videoUrl} />
          ))}
        </Row>
      )}

      {adsAndReels.length > 0 && (
        <Row title="Ads & reels" hint="Brand spots and short-form castings">
          {adsAndReels.map((story) => (
            <PosterCard key={story.id} story={story} cast={castForStory(world, story.id).map((entry) => entry.character)} authorName={getUser(world, story.authorId)?.name} />
          ))}
        </Row>
      )}

      <section className="mt-9">
        <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
          <h2 className="marquee-title text-lg uppercase tracking-wide sm:text-xl">Series slate</h2>
          <Link href="/series/new" className="text-[11px] font-semibold text-accent hover:underline">+ Build a pilot</Link>
        </div>
        {series.length === 0 ? (
          <div className="poster-card rounded-lg p-8 text-center">
            <p className="reel-title text-xl">The slate is empty.</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-grey">
              Start with one audience promise, one recurring conflict, and a 60-second pilot that ends on a real cliffhanger.
            </p>
            <Link href="/series/new" className="mt-5 inline-block rounded-full border border-accent px-5 py-2 text-sm text-accent">
              Create the first series
            </Link>
          </div>
        ) : (
          <Carousel>
            {series.map((item) => (
              <Link key={item.id} href={`/series/${item.id}`} className="poster-card group w-72 shrink-0 snap-start rounded-lg p-5">
                <div className="mb-4 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.15em]">
                  <span className="text-accent">{item.genre}</span>
                  <span className="text-grey">{item.status}</span>
                </div>
                <h3 className="reel-title text-xl group-hover:text-accent-light">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-grey">{item.logline}</p>
                <p className="mt-4 border-t border-line pt-3 text-[11px] text-grey">
                  {item.episodeCount} episodes · {item.episodeDurationSeconds}s · {item.primaryLanguage}
                </p>
              </Link>
            ))}
          </Carousel>
        )}
      </section>
    </main>
  );
}
