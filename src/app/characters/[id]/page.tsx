"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import { getCharacter, getUser, resumeForCharacter, ledgerForCharacter } from "@/lib/selectors";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import VoicePlayButton from "@/components/VoicePlayButton";
import EarningsSparkline from "@/components/EarningsSparkline";
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

export default function CharacterProfilePage() {
  const params = useParams<{ id: string }>();
  const world = useChaplinStore((s) => s);
  const character = getCharacter(world, params.id);

  if (!character) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-grey mb-4">This character isn&apos;t on the shelf (yet).</p>
        <Link href="/characters" className="text-accent hover:underline">
          ← Back to the Shelf
        </Link>
      </div>
    );
  }

  const maker = getUser(world, character.makerId);
  const resume = resumeForCharacter(world, character.id);
  const ledger = ledgerForCharacter(world, character.id);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 w-full">
      <Link href="/characters" className="text-xs text-grey hover:text-accent">
        ← The Shelf
      </Link>

      {/* Casting card header */}
      <div className="poster-card rounded-md p-6 mt-3 flex flex-col md:flex-row gap-6">
        <span className="accent-ring shrink-0 self-start">
          <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={96} />
        </span>

        <div className="flex-1 min-w-0">
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
          <p className="italic text-grey mb-3">&ldquo;{character.tagline}&rdquo;</p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            <Chip label={ARCHETYPE_LABEL[character.archetype]} hue={ARCHETYPE_HUE[character.archetype]} />
            <Chip label={LICENSE_LABEL[character.licenseType]} hue={LICENSE_HUE[character.licenseType]} />
          </div>

          <VoicePlayButton durationSec={4} label={`Hear ${character.name.split(" ")[0]}`} />
        </div>

        <div className="flex md:flex-col gap-4 md:gap-2 md:text-right shrink-0 md:w-40">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Left: personality, voice, license terms */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <section className="poster-card rounded-md p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-2">
              Personality
            </h2>
            <p className="text-sm leading-relaxed">{character.personality}</p>
          </section>

          <section className="poster-card rounded-md p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grey">
              Sound profile
            </h2>
            <div>
              <p className="text-[11px] text-grey mb-1">Voice</p>
              <p className="text-sm leading-relaxed mb-2">{character.voiceDesc}</p>
              <VoicePlayButton durationSec={4} label="Hear voice" compact />
            </div>
            <div>
              <p className="text-[11px] text-grey mb-1">Signature SFX</p>
              <p className="text-sm leading-relaxed mb-2">{character.sfxDesc}</p>
              <VoicePlayButton durationSec={2} label="Hear SFX" compact />
            </div>
            <div>
              <p className="text-[11px] text-grey mb-1">Theme score</p>
              <p className="text-sm leading-relaxed mb-2">{character.themeDesc}</p>
              <VoicePlayButton durationSec={6} label="Hear theme" compact />
            </div>
          </section>

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
          <section className="poster-card rounded-md p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grey mb-2">
              License terms
            </h2>
            <p className="text-sm mb-1">{LICENSE_LABEL[character.licenseType]}</p>
            <p className="text-xs text-grey">
              {character.licenseType === "open" &&
                "Anyone can cast this character for free. The maker still earns from fan tips."}
              {character.licenseType === "paid" &&
                `Casting this character costs ${money(character.royaltyRate)}, paid to the maker every time.`}
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

          <Link
            href={`/studio/write?cast=${character.id}`}
            className="bg-accent text-paper font-semibold text-center px-4 py-3 rounded-sm hover:bg-accent-light transition-colors"
          >
            Cast {character.name.split(" ")[0]} in a story
          </Link>
        </div>
      </div>
    </div>
  );
}
