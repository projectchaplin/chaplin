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
  const image = character.bannerUrl ?? character.imageUrl ?? character.galleryUrls?.[0];
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
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
          <h3 className="reel-title truncate text-base leading-tight text-ink sm:text-xl">{character.name}</h3>
          {makerName && <p className="truncate text-[10px] text-ink/70 sm:text-[11px]">by {makerName}</p>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:gap-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          <Chip label={ARCHETYPE_LABEL[character.archetype]} hue={ARCHETYPE_HUE[character.archetype]} />
          <span className="hidden sm:inline-flex">
            <Chip label={LICENSE_LABEL[character.licenseType]} hue={LICENSE_HUE[character.licenseType]} />
          </span>
        </div>

        <p className="line-clamp-2 flex-1 text-[11px] italic leading-snug text-grey sm:text-sm">&ldquo;{character.tagline}&rdquo;</p>

        <p className="truncate whitespace-nowrap border-t border-line pt-1.5 text-[10px] text-grey sm:pt-2 sm:text-xs">
          <b className="text-ink">{character.stats.castings}</b> cast · <b className="text-ink">{compactNumber(character.stats.fans)}</b> fans
          {character.stats.earnings > 0 && (
            <span className="text-accent font-semibold"> · {money(character.stats.earnings)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
