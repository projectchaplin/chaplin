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

export default function ShelfPage() {
  const world = useChaplinStore((s) => s);
  const [query, setQuery] = useState("");
  const [archetypes, setArchetypes] = useState<Set<Archetype>>(new Set());
  const [licenses, setLicenses] = useState<Set<LicenseType>>(new Set());
  const [sort, setSort] = useState<SortKey>("castings");

  function toggleArchetype(a: Archetype) {
    setArchetypes((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  function toggleLicense(l: LicenseType) {
    setLicenses((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  }

  const results = useMemo(() => {
    let list = world.characters;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline.toLowerCase().includes(q) ||
          c.personality.toLowerCase().includes(q)
      );
    }
    if (archetypes.size > 0) {
      list = list.filter((c) => archetypes.has(c.archetype));
    }
    if (licenses.size > 0) {
      list = list.filter((c) => licenses.has(c.licenseType));
    }
    list = [...list];
    if (sort === "castings") list.sort((a, b) => b.stats.castings - a.stats.castings);
    if (sort === "fans") list.sort((a, b) => b.stats.fans - a.stats.fans);
    if (sort === "newest") list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list;
  }, [world.characters, query, archetypes, licenses, sort]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      <SectionHeading
        eyebrow="The Shelf"
        title="Every AI actor, ready to be cast"
      />

      {/* Compact filter bar: search + sort on one line, filters as single scroll rows */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grey">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: “sarcastic detective”, “warm grandmother”…"
              className="w-full rounded-full border border-line bg-paper/60 py-2.5 pl-9 pr-4 text-sm backdrop-blur-sm transition-colors focus:border-accent focus:outline-none"
            />
          </div>
          <select
            id="sort"
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="shrink-0 rounded-full border border-line bg-paper/60 px-3 py-2.5 text-xs backdrop-blur-sm focus:border-accent focus:outline-none"
          >
            <option value="castings">Most cast</option>
            <option value="fans">Most fans</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-1 py-0.5">
          {ARCHETYPES.map((a) => (
            <button key={a} onClick={() => toggleArchetype(a)} className="shrink-0">
              <Chip label={ARCHETYPE_LABEL[a]} hue={ARCHETYPE_HUE[a]} filled={archetypes.has(a)} />
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-line" />
          {LICENSE_TYPES.map((l) => (
            <button key={l} onClick={() => toggleLicense(l)} className="shrink-0">
              <Chip label={LICENSE_LABEL[l]} hue={LICENSE_HUE[l]} filled={licenses.has(l)} />
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-grey mb-3">
        {results.length} AI actor{results.length === 1 ? "" : "s"} on the shelf
      </p>

      {results.length === 0 ? (
        <div className="poster-card rounded-md p-10 text-center text-grey">
          No one matches that search yet. Maybe it&apos;s time to build them.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((character) => {
            const maker = getUser(world, character.makerId);
            return (
              <CharacterCard key={character.id} character={character} makerName={maker?.name} />
            );
          })}
        </div>
      )}
    </div>
  );
}
