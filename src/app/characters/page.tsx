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

      <div className="poster-card rounded-md p-4 mb-6 flex flex-col gap-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, trait, or vibe: “sarcastic detective”, “warm grandmother”…"
          className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />

        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] uppercase tracking-wide text-grey self-center mr-1">
            Archetype
          </span>
          {ARCHETYPES.map((a) => (
            <button key={a} onClick={() => toggleArchetype(a)}>
              <Chip
                label={ARCHETYPE_LABEL[a]}
                hue={ARCHETYPE_HUE[a]}
                filled={archetypes.has(a)}
              />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-grey self-center mr-1">
            License
          </span>
          {LICENSE_TYPES.map((l) => (
            <button key={l} onClick={() => toggleLicense(l)}>
              <Chip label={LICENSE_LABEL[l]} hue={LICENSE_HUE[l]} filled={licenses.has(l)} />
            </button>
          ))}

          <span className="ml-auto flex items-center gap-2 text-xs">
            <label className="text-grey" htmlFor="sort">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="border border-line rounded-sm px-2 py-1 bg-paper"
            >
              <option value="castings">Most cast</option>
              <option value="fans">Most fans</option>
              <option value="newest">Newest</option>
            </select>
          </span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
