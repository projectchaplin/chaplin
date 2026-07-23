"use client";

import type { Character } from "@/lib/types";
import Chip from "@/components/Chip";
import { buildProductionBible } from "@/lib/production-prompting";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL } from "@/lib/format";

function humanize(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CharacterPersonalityCard({ character }: { character: Character }) {
  const bible = buildProductionBible(character);
  const archetypes = character.archetypeMix?.length
    ? character.archetypeMix
    : [character.archetype];
  const facets = [
    {
      label: "Drive",
      value: bible.dramatic.externalWant,
      accent: "text-accent",
    },
    {
      label: "Inner conflict",
      value: bible.dramatic.contradiction,
      accent: "text-amber-300",
    },
    {
      label: "Under pressure",
      value: bible.performance.underPressure,
      accent: "text-accent-secondary",
    },
    {
      label: "Screen presence",
      value: bible.performance.movementStyle,
      accent: "text-sky-300",
    },
  ];

  return (
    <section className="personality-card overflow-hidden rounded-[22px] border border-white/12">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent">Character DNA</p>
            <h2 className="reel-title mt-1 text-2xl">Personality at a glance</h2>
          </div>
          <span className="rounded-full border border-accent-secondary/35 bg-accent-secondary/10 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-accent-secondary">
            Canon
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Character personality tags">
          {archetypes.map((archetype) => (
            <Chip
              key={archetype}
              label={ARCHETYPE_LABEL[archetype]}
              hue={ARCHETYPE_HUE[archetype]}
              filled={archetype === character.archetype}
              glass
            />
          ))}
          {bible.story.recurringMotifs.slice(0, 3).map((motif, index) => (
            <Chip
              key={motif}
              label={humanize(motif)}
              hue={[165, 330, 42][index] ?? 165}
              glass
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2">
        {facets.map((facet, index) => (
          <article key={facet.label} className="personality-facet relative bg-[#121a0d]/95 p-4">
            <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${facet.accent}`}>
              {String(index + 1).padStart(2, "0")} · {facet.label}
            </span>
            <p className="mt-2 text-[12px] leading-relaxed text-white/78">{facet.value}</p>
          </article>
        ))}
      </div>

      <details className="group border-t border-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold text-white/68 hover:text-white sm:px-5">
          <span>Read the full character</span>
          <span className="text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="border-t border-white/10 px-4 py-4 sm:px-5">
          <p className="text-[12px] leading-7 text-white/68">{character.personality}</p>
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
            <p className="text-[11px] leading-relaxed text-white/58">
              <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.16em] text-white/35">Needs to learn</span>
              {bible.dramatic.innerNeed}
            </p>
            <p className="text-[11px] leading-relaxed text-white/58">
              <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.16em] text-white/35">Will never cross</span>
              {bible.dramatic.moralBoundary}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
