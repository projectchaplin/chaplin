"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import { getUser } from "@/lib/selectors";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import SectionHeading from "@/components/SectionHeading";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, money, compactNumber } from "@/lib/format";

export default function LeaderboardPage() {
  const world = useChaplinStore((s) => s);
  const [query, setQuery] = useState("");

  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...world.characters]
      .filter((c) => {
        if (!q) return true;
        const maker = getUser(world, c.makerId);
        return c.name.toLowerCase().includes(q) || maker?.name.toLowerCase().includes(q);
      })
      .sort((a, b) => b.stats.earnings - a.stats.earnings);
  }, [world, query]);

  const totalPaid = world.ledger.reduce((sum, l) => sum + l.amount, 0);
  const uniqueMakers = new Set(world.characters.map((c) => c.makerId)).size;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 w-full">
      <SectionHeading eyebrow="The Star System" title="Global Leaderboard" />
      <p className="text-sm text-grey -mt-2 mb-6">
        Every AI actor on the shelf, ranked by lifetime earnings. See what each actor is making.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="poster-card rounded-md p-4 text-center">
          <p className="text-2xl font-semibold text-accent">{money(totalPaid)}</p>
          <p className="text-[11px] text-grey uppercase tracking-wide">Paid to makers</p>
        </div>
        <div className="poster-card rounded-md p-4 text-center">
          <p className="text-2xl font-semibold">{world.castings.length}</p>
          <p className="text-[11px] text-grey uppercase tracking-wide">Castings made</p>
        </div>
        <div className="poster-card rounded-md p-4 text-center">
          <p className="text-2xl font-semibold">{uniqueMakers}</p>
          <p className="text-[11px] text-grey uppercase tracking-wide">Makers earning</p>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by actor or maker…"
        className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-sm mb-4 focus:outline-none focus:border-accent"
      />

      <p className="text-xs text-grey mb-3">
        {ranked.length} AI actor{ranked.length === 1 ? "" : "s"} ranked
      </p>

      <div className="poster-card rounded-md divide-y divide-line">
        {ranked.map((character, i) => {
          const maker = getUser(world, character.makerId);
          return (
            <Link
              key={character.id}
              href={`/characters/${character.id}`}
              className="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <span
                className={`marquee-title text-xl sm:text-2xl w-8 text-center shrink-0 ${
                  i < 3 ? "accent-text" : "text-grey"
                }`}
              >
                {i + 1}
              </span>
              {i < 3 ? (
                <span className="accent-ring shrink-0">
                  <Avatar
                    hue={character.avatarHue}
                    label={character.name}
                    src={character.imageUrl}
                    size={40}
                  />
                </span>
              ) : (
                <Avatar
                  hue={character.avatarHue}
                  label={character.name}
                  src={character.imageUrl}
                  size={40}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{character.name}</p>
                <p className="text-xs text-grey truncate">made by {maker?.name ?? "unknown"}</p>
              </div>
              <div className="hidden sm:block shrink-0">
                <Chip
                  label={ARCHETYPE_LABEL[character.archetype]}
                  hue={ARCHETYPE_HUE[character.archetype]}
                />
              </div>
              <div className="text-right shrink-0">
                <p className="text-accent font-semibold text-sm">
                  {character.stats.earnings > 0 ? money(character.stats.earnings) : "not yet"}
                </p>
                <p className="text-xs text-grey">
                  {character.stats.castings} castings · {compactNumber(character.stats.fans)} fans
                </p>
              </div>
            </Link>
          );
        })}

        {ranked.length === 0 && (
          <div className="p-10 text-center text-grey">Nothing matches that search yet.</div>
        )}
      </div>
    </div>
  );
}
