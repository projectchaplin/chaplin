import Link from "next/link";
import Image from "next/image";
import type { Character } from "@/lib/types";
import Chip from "@/components/Chip";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, LICENSE_HUE, LICENSE_LABEL, hsl, compactNumber, money } from "@/lib/format";

export default function CharacterCard({
  character,
  makerName,
}: {
  character: Character;
  makerName?: string;
}) {
  const image = character.bannerUrl ?? character.imageUrl;
  const hue = ARCHETYPE_HUE[character.archetype];

  return (
    <Link
      href={`/characters/${character.id}`}
      className="group poster-card rounded-md overflow-hidden flex flex-col h-full"
    >
      <div className="relative aspect-[6/5] shrink-0 overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={character.name}
            fill
            sizes="(max-width: 640px) 260px, 320px"
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              character.bannerUrl ? "object-[68%_center]" : "object-center"
            }`}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${hsl(hue, 60, 22)}, ${hsl(hue, 70, 8)})`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="reel-title text-xl leading-tight text-ink truncate">{character.name}</h3>
          {makerName && <p className="text-[11px] text-ink/70 truncate">by {makerName}</p>}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap gap-1.5">
          <Chip label={ARCHETYPE_LABEL[character.archetype]} hue={ARCHETYPE_HUE[character.archetype]} />
          <Chip label={LICENSE_LABEL[character.licenseType]} hue={LICENSE_HUE[character.licenseType]} />
        </div>

        <p className="text-sm text-grey italic leading-snug flex-1">&ldquo;{character.tagline}&rdquo;</p>

        <div className="flex items-center justify-between text-xs text-grey border-t border-line pt-2">
          <span>
            <b className="text-ink">{character.stats.castings}</b> castings
          </span>
          <span>
            <b className="text-ink">{compactNumber(character.stats.fans)}</b> fans
          </span>
          <span className="text-accent font-semibold">
            {character.stats.earnings > 0 ? money(character.stats.earnings) : "not yet"}
          </span>
        </div>
      </div>
    </Link>
  );
}
