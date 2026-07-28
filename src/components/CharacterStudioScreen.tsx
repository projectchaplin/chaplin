"use client";

import { useRouter } from "next/navigation";
import CharacterProductionStudio from "@/components/CharacterProductionStudio";
import Avatar from "@/components/Avatar";
import type { Character } from "@/lib/types";

export default function CharacterStudioScreen({ character }: { character: Character }) {
  const router = useRouter();

  return (
    <main className="studio-shell min-h-[100dvh] bg-[#070a08] lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden" data-character-studio-shell>
      <header className="studio-shell__bar flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => router.push(`/characters/${character.id}`)} className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-grey hover:border-accent hover:text-ink">
            ← Actor
          </button>
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
          <div className="flex min-w-0 items-center gap-2">
            <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{character.name}</span>
              <span className="block text-[9px] uppercase tracking-[0.14em] text-emerald-400">Production studio · autosaved</span>
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-semibold text-grey">Private workspace</span>
          <button type="button" onClick={() => router.push(`/characters/${character.id}`)} className="rounded-md bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper hover:bg-accent-light">
            Finish scene
          </button>
        </div>
      </header>
      <CharacterProductionStudio character={character} onExit={() => router.push(`/characters/${character.id}`)} />
    </main>
  );
}
