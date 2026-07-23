"use client";

import { useMemo, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import { getUser } from "@/lib/selectors";
import CharacterCard from "@/components/CharacterCard";
import SectionHeading from "@/components/SectionHeading";
import Chip from "@/components/Chip";
import { ARCHETYPES, LICENSE_TYPES } from "@/data/seed";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, LICENSE_HUE, LICENSE_LABEL } from "@/lib/format";
import type { Archetype, LicenseType } from "@/lib/types";

type SortKey = "castings" | "newest" | "fans";

function newestFirst(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export default function ShelfPage() {
  const world = useChaplinStore((s) => s);
  const [query, setQuery] = useState("");
  const [archetypes, setArchetypes] = useState<Set<Archetype>>(new Set());
  const [licenses, setLicenses] = useState<Set<LicenseType>>(new Set());
  const [sort, setSort] = useState<SortKey>("newest");

  function toggleArchetype(archetype: Archetype) {
    setArchetypes((previous) => {
      const next = new Set(previous);
      if (next.has(archetype)) next.delete(archetype);
      else next.add(archetype);
      return next;
    });
  }

  function toggleLicense(license: LicenseType) {
    setLicenses((previous) => {
      const next = new Set(previous);
      if (next.has(license)) next.delete(license);
      else next.add(license);
      return next;
    });
  }

  const results = useMemo(() => {
    let list = world.characters;
    if (query.trim()) {
      const normalizedQuery = query.trim().toLowerCase();
      list = list.filter(
        (character) =>
          character.name.toLowerCase().includes(normalizedQuery) ||
          character.tagline.toLowerCase().includes(normalizedQuery) ||
          character.personality.toLowerCase().includes(normalizedQuery),
      );
    }
    if (archetypes.size > 0) {
      list = list.filter((character) => archetypes.has(character.archetype));
    }
    if (licenses.size > 0) {
      list = list.filter((character) => licenses.has(character.licenseType));
    }
    list = [...list];
    if (sort === "castings") list.sort((a, b) => b.stats.castings - a.stats.castings || newestFirst(a, b));
    if (sort === "fans") list.sort((a, b) => b.stats.fans - a.stats.fans || newestFirst(a, b));
    if (sort === "newest") list.sort(newestFirst);
    return list;
  }, [world.characters, query, archetypes, licenses, sort]);

  return (
    <div className="shelf-stage relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="shelf-aurora shelf-aurora-pink" />
      <div aria-hidden="true" className="shelf-aurora shelf-aurora-mint" />

      <div className="relative z-10">
        <SectionHeading eyebrow="The Shelf" title="Every AI actor, ready to be cast" />
      </div>

      <div className="shelf-filter-glass relative z-10 mb-6 flex flex-col gap-3 rounded-[24px] p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actors, voices, worlds..."
              className="shelf-search w-full rounded-full py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <select
            id="sort"
            aria-label="Sort actors"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="shelf-sort max-w-[7.5rem] shrink-0 rounded-full px-3 py-3 text-xs text-white focus:outline-none sm:max-w-none"
          >
            <option value="newest">Newest</option>
            <option value="castings">Most cast</option>
            <option value="fans">Most fans</option>
          </select>
        </div>

        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-1 py-0.5">
          {ARCHETYPES.map((archetype) => (
            <button
              key={archetype}
              type="button"
              aria-pressed={archetypes.has(archetype)}
              onClick={() => toggleArchetype(archetype)}
              className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Chip
                label={ARCHETYPE_LABEL[archetype]}
                hue={ARCHETYPE_HUE[archetype]}
                filled={archetypes.has(archetype)}
                glass
              />
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/15" />
          {LICENSE_TYPES.map((license) => (
            <button
              key={license}
              type="button"
              aria-pressed={licenses.has(license)}
              onClick={() => toggleLicense(license)}
              className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Chip
                label={LICENSE_LABEL[license]}
                hue={LICENSE_HUE[license]}
                filled={licenses.has(license)}
                glass
              />
            </button>
          ))}
        </div>
      </div>


      {results.length === 0 ? (
        <div className="shelf-filter-glass relative z-10 rounded-[24px] p-10 text-center text-grey">
          No one matches that search yet. Maybe it&apos;s time to build them.
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((character) => {
            const maker = getUser(world, character.makerId);
            return <CharacterCard key={character.id} character={character} makerName={maker?.name} />;
          })}
        </div>
      )}
    </div>
  );
}
