import Link from "next/link";
import type { Character } from "@/lib/types";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, LICENSE_HUE, LICENSE_LABEL, compactNumber, money } from "@/lib/format";

export default function CharacterCard({
  character,
  makerName,
}: {
  character: Character;
  makerName?: string;
}) {
  return (
    <Link
      href={`/characters/${character.id}`}
      className="poster-card rounded-md p-4 flex flex-col gap-3 h-full"
    >
      <div className="flex items-start gap-3">
        <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="reel-title text-lg leading-tight truncate">{character.name}</h3>
          {makerName && <p className="text-[11px] text-grey truncate">by {makerName}</p>}
        </div>
      </div>

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
    </Link>
  );
}
