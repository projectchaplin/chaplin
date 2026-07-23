"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import { getCharacter, getUser, resumeForCharacter, ledgerForCharacter } from "@/lib/selectors";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import CharacterSoundProfile from "@/components/CharacterSoundProfile";
import CharacterPersonalityCard from "@/components/CharacterPersonalityCard";
import EarningsSparkline from "@/components/EarningsSparkline";
import CharacterGallery from "@/components/CharacterGallery";
import DeveloperAccessCard from "@/components/DeveloperAccessCard";
import CharacterProductionStudio from "@/components/CharacterProductionStudio";
import CharacterBroll from "@/components/CharacterBroll";
import { IconArrowLeft } from "@/components/Icons";
import {
  ARCHETYPE_HUE,
  ARCHETYPE_LABEL,
  LICENSE_HUE,
  LICENSE_LABEL,
  compactNumber,
  money,
  formatDate,
  timeAgo,
} from "@/lib/format";

type CharacterVideoAsset = {
  id: string;
  url: string;
  durationSeconds: number | null;
  label: string;
  createdAt: string | null;
};

export default function CharacterProfilePage() {
  const params = useParams<{ id: string }>();
  const world = useChaplinStore((s) => s);
  const character = getCharacter(world, params.id);
  const [productionOpen, setProductionOpen] = useState(false);
  const [availableVideos, setAvailableVideos] = useState<CharacterVideoAsset[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);

  useEffect(() => {
    if (!character?.id) return;
    let active = true;
    const loadVideos = async () => {
      setVideosLoading(true);
      try {
        const response = await fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`, { cache: "no-store" });
        const data = await response.json() as {
          production?: {
            assets?: Array<{
              id: string;
              kind: string;
              url: string;
              duration_seconds: number | null;
              metadata: Record<string, unknown> | null;
              created_at: string;
            }>;
          };
        };
        if (!response.ok) throw new Error("Character media could not be loaded.");
        const seen = new Set<string>();
        const videos: CharacterVideoAsset[] = [];
        for (const asset of data.production?.assets ?? []) {
          if (asset.kind !== "video" || !asset.url || seen.has(asset.url)) continue;
          seen.add(asset.url);
          const outputType = typeof asset.metadata?.outputType === "string" ? asset.metadata.outputType : "";
          const duration = asset.duration_seconds;
          videos.push({
            id: asset.id,
            url: asset.url,
            durationSeconds: duration,
            label: outputType === "punch"
              ? "Punch master"
              : outputType === "spark"
                ? "Spark"
                : duration && duration <= 5
                  ? "Four-second scene"
                  : "Performance video",
            createdAt: asset.created_at,
          });
        }
        if (character.videoUrl && !seen.has(character.videoUrl)) {
          videos.unshift({
            id: "profile-video",
            url: character.videoUrl,
            durationSeconds: null,
            label: "Featured performance",
            createdAt: null,
          });
        }
        if (active) setAvailableVideos(videos);
      } catch {
        if (active) setAvailableVideos(character.videoUrl ? [{
          id: "profile-video",
          url: character.videoUrl,
          durationSeconds: null,
          label: "Featured performance",
          createdAt: null,
        }] : []);
      } finally {
        if (active) setVideosLoading(false);
      }
    };
    void loadVideos();
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ characterId?: string }>).detail;
      if (!detail?.characterId || detail.characterId === character.id) void loadVideos();
    };
    window.addEventListener("chaplin:media-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("chaplin:media-updated", refresh);
    };
  }, [character?.id, character?.videoUrl]);

  if (!character) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-grey mb-4">This AI actor isn&apos;t on the shelf (yet).</p>
        <Link href="/characters" className="text-accent hover:underline">
          ← Back to the Shelf
        </Link>
      </div>
    );
  }

  const maker = getUser(world, character.makerId);
  const resume = resumeForCharacter(world, character.id);
  const ledger = ledgerForCharacter(world, character.id);
  const canProduce = world.activeRole === "admin" || (world.activeRole === "maker" && character.makerId === world.currentUserId);
  const canCast = world.activeRole === "admin" || world.activeRole === "caster" || world.activeRole === "brand";

  function openProductionStudio() {
    setProductionOpen(true);
    window.setTimeout(() => {
      document.getElementById("production-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full min-w-0 overflow-x-clip">
      <Link
        href="/characters"
        className="inline-flex items-center gap-1.5 pl-2.5 pr-4 py-2 rounded-full poster-card text-sm font-semibold hover:text-accent transition-colors mb-3"
      >
        <IconArrowLeft className="w-4 h-4" />
        Shelf
      </Link>

      {/* Casting card header */}
      {character.bannerUrl ? (
        <div className="poster-card rounded-md overflow-hidden">
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/7] lg:aspect-[2/1]">
            <CharacterBroll character={character} />
            <div className="absolute inset-0 flex max-w-[78%] flex-col justify-end gap-1 p-4 pb-3 sm:max-w-[52%] sm:gap-2 sm:p-8">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <h1 className="reel-title text-xl leading-none text-ink sm:text-4xl sm:leading-tight">
                  {character.name}
                </h1>
                {maker && (
                  <span className="text-[9px] text-ink/65 sm:text-xs">
                    made by{" "}
                    <Link href="/studio" className="text-accent hover:underline">
                      {maker.name}
                    </Link>
                  </span>
                )}
              </div>
              <p data-broll-punchline className="line-clamp-2 text-xs italic leading-snug text-ink/75 sm:line-clamp-none sm:text-base sm:text-ink/80">
                &ldquo;{character.tagline}&rdquo;
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1 sm:mt-1 sm:gap-1.5">
                <Chip compact label={ARCHETYPE_LABEL[character.archetype]} hue={ARCHETYPE_HUE[character.archetype]} />
                <Chip compact label={LICENSE_LABEL[character.licenseType]} hue={LICENSE_HUE[character.licenseType]} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
            <div className="p-2.5 text-center sm:p-4">
              <p className="text-base font-semibold sm:text-xl">{character.stats.castings}</p>
              <p className="text-[8px] uppercase tracking-wide text-grey sm:text-[11px]">Castings</p>
            </div>
            <div className="p-2.5 text-center sm:p-4">
              <p className="text-base font-semibold sm:text-xl">{compactNumber(character.stats.fans)}</p>
              <p className="text-[8px] uppercase tracking-wide text-grey sm:text-[11px]">Fans</p>
            </div>
            <div className="p-2.5 text-center sm:p-4">
              <p className="text-base font-semibold text-accent sm:text-xl">{money(character.stats.earnings)}</p>
              <p className="text-[8px] uppercase tracking-wide text-grey sm:text-[11px]">Lifetime earnings</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="poster-card rounded-md p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden min-h-72">
          <CharacterBroll character={character} />
          <span className="accent-ring shrink-0 self-start relative z-10 mt-auto">
            <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={96} />
          </span>

          <div className="flex-1 min-w-0 relative z-10 mt-auto">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="reel-title text-3xl">{character.name}</h1>
              {maker && (
                <span className="text-xs text-grey">
                  made by{" "}
                  <Link href="/studio" className="text-accent hover:underline">
                    {maker.name}
                  </Link>
                </span>
              )}
            </div>
            <p data-broll-punchline className="italic text-grey mb-3">&ldquo;{character.tagline}&rdquo;</p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              <Chip label={ARCHETYPE_LABEL[character.archetype]} hue={ARCHETYPE_HUE[character.archetype]} />
              <Chip label={LICENSE_LABEL[character.licenseType]} hue={LICENSE_HUE[character.licenseType]} />
            </div>

          </div>

          <div className="flex md:flex-col gap-4 md:gap-2 md:text-right shrink-0 md:w-40 relative z-10 mt-auto">
            <div>
              <p className="text-xl font-semibold">{character.stats.castings}</p>
              <p className="text-[11px] text-grey uppercase tracking-wide">Castings</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{compactNumber(character.stats.fans)}</p>
              <p className="text-[11px] text-grey uppercase tracking-wide">Fans</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-accent">{money(character.stats.earnings)}</p>
              <p className="text-[11px] text-grey uppercase tracking-wide">Lifetime earnings</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Left: personality, voice, license terms */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <CharacterPersonalityCard character={character} />

          {character.galleryUrls && character.galleryUrls.length > 0 && (
            <CharacterGallery name={character.name} images={character.galleryUrls} />
          )}

          <CharacterSoundProfile character={character} canProduce={canProduce} onOpenProduction={openProductionStudio} />

          <section className="poster-card rounded-md p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-2">
              Résumé: every story so far
            </h2>
            {resume.length === 0 ? (
              <p className="text-sm text-grey">Not cast yet. This story could be the first.</p>
            ) : (
              <ul className="divide-y divide-line">
                {resume.map(({ casting, story }) => {
                  const lineCount = story.scenes.reduce(
                    (n, sc) => n + sc.lines.filter((l) => l.characterId === character.id).length,
                    0
                  );
                  return (
                    <li key={casting.id} className="py-3">
                      <Link
                        href={`/stories/${story.id}`}
                        className="flex items-center justify-between gap-3 hover:text-accent"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{story.title}</span>
                          <span className="block text-xs text-grey">
                            {lineCount} line{lineCount === 1 ? "" : "s"} · cast {timeAgo(casting.timestamp)}
                          </span>
                        </span>
                        <span className="text-xs text-grey shrink-0">
                          {casting.fee > 0 ? money(casting.fee) : "open"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Right: license terms + earnings + CTA */}
        <div className="flex flex-col gap-6">
          <section className="poster-card overflow-hidden rounded-md">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-grey">Available videos</h2>
                <p className="mt-0.5 text-[9px] text-grey">Spark, scenes, and finished performances</p>
              </div>
              <span className="rounded-full border border-accent-secondary/35 px-2 py-1 font-mono text-[9px] text-accent-secondary">
                {availableVideos.length}
              </span>
            </div>
            {videosLoading ? (
              <div className="flex items-center gap-2 px-4 py-5 text-xs text-grey">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                Loading performances…
              </div>
            ) : availableVideos.length ? (
              <div className="max-h-[34rem] space-y-3 overflow-y-auto p-3 scrollbar-thin">
                {availableVideos.map((video, index) => (
                  <article key={video.id} className="overflow-hidden rounded-lg border border-line bg-black/30">
                    <video
                      src={video.url}
                      controls
                      playsInline
                      preload="metadata"
                      poster={character.imageUrl ?? character.bannerUrl}
                      className="aspect-video w-full bg-black object-cover"
                      aria-label={`${video.label} for ${character.name}`}
                    />
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold">{video.label}</p>
                        <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-grey">
                          {video.durationSeconds ? `${Math.round(video.durationSeconds)} sec` : index === 0 ? "Profile selection" : "Saved video"}
                        </p>
                      </div>
                      {index === 0 && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-accent">
                          Latest
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-4 py-5">
                <p className="text-xs font-semibold">No performance video yet</p>
                <p className="mt-1 text-[10px] leading-4 text-grey">
                  A Spark or generated scene will appear here as soon as it is saved.
                </p>
                {canProduce && (
                  <button
                    type="button"
                    onClick={openProductionStudio}
                    className="mt-3 rounded-full border border-accent/55 px-3 py-1.5 text-[9px] font-semibold text-accent"
                  >
                    Create the first video
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="poster-card rounded-md p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-2">
              License terms
            </h2>
            <p className="text-sm mb-1">{LICENSE_LABEL[character.licenseType]}</p>
            <p className="text-xs text-grey">
              {character.licenseType === "open" &&
                "Anyone can cast this AI actor for free. The maker still earns from fan tips."}
              {character.licenseType === "paid" &&
                `Casting this AI actor costs ${money(character.royaltyRate)}, paid to the maker every time.`}
              {character.licenseType === "approval" &&
                `The maker signs off on each story before ${character.name} can appear in it. Fee once approved: ${money(character.royaltyRate)}.`}
            </p>
            <p className="text-[11px] text-grey mt-3">
              On the shelf since {formatDate(character.createdAt)}
            </p>
          </section>

          <section className="poster-card rounded-md p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-2">
              Earnings over time
            </h2>
            <EarningsSparkline entries={ledger} />
          </section>

          {canProduce && <DeveloperAccessCard character={character} />}

          {canCast && (
            <Link
              href={`/studio/write?cast=${character.id}`}
              className="bg-accent text-paper font-semibold text-center px-4 py-3 rounded-sm hover:bg-accent-light transition-colors"
            >
              Cast {character.name.split(" ")[0]} in a story
            </Link>
          )}
          {world.activeRole === "maker" && character.makerId === world.currentUserId && (
            <Link
              href="/studio"
              className="border border-accent text-accent font-semibold text-center px-4 py-3 rounded-sm hover:bg-accent/10 transition-colors"
            >
              Manage {character.name.split(" ")[0]}
            </Link>
          )}
        </div>
      </div>

      {canProduce && (
        <details
          id="production-studio"
          open={productionOpen}
          onToggle={(event) => setProductionOpen(event.currentTarget.open)}
          className="mt-6 scroll-mt-24 rounded-md border border-line bg-paper/30"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.03] sm:px-6">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Production Studio</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-grey">
                Create or reuse voice, dialogue, sound, images, and video for {character.name}.
              </span>
            </span>
            <span className="shrink-0 rounded-full border border-accent/60 px-3 py-1.5 text-[10px] font-semibold text-accent">
              {productionOpen ? "Close" : "Open studio"}
            </span>
          </summary>
          <div className="border-t border-line">
            <CharacterProductionStudio
              character={character}
              onExit={() => {
                const studio = document.getElementById("production-studio") as HTMLDetailsElement | null;
                if (studio) studio.open = false;
                setProductionOpen(false);
                window.requestAnimationFrame(() => {
                  studio?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
          </div>
        </details>
      )}
    </div>
  );
}
