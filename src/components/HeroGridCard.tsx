import Link from "next/link";
import Image from "next/image";
import type { Character } from "@/lib/types";
import { ARCHETYPE_LABEL, ARCHETYPE_HUE, hsl } from "@/lib/format";

export default function HeroGridCard({
  character,
  active = false,
  onActivate,
}: {
  character: Character;
  active?: boolean;
  onActivate?: () => void;
}) {
  const hue = ARCHETYPE_HUE[character.archetype];

  function handleClick(e: React.MouseEvent) {
    // Devices with real hover (mouse/trackpad) always navigate on click, since
    // hovering already previewed the tile. Touch-only devices never fire our
    // onMouseEnter, so there a first tap should preview instead of navigating,
    // and only a second tap (on the now-active tile) goes through.
    const canHover =
      typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
    if (!canHover && !active) {
      e.preventDefault();
      onActivate?.();
    }
  }

  return (
    <Link
      href={`/characters/${character.id}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={handleClick}
      className={`group relative overflow-hidden rounded-lg block transition-[grid-column,grid-row] ${
        active ? "col-span-2 row-span-2" : ""
      }`}
      style={
        active
          ? { boxShadow: "0 0 0 2px var(--accent), 0 0 36px var(--accent-glow)" }
          : { boxShadow: "0 0 0 1px var(--line)" }
      }
    >
      <div className="absolute inset-0">
        {character.imageUrl ? (
          <Image
            src={character.imageUrl}
            alt={character.name}
            fill
            sizes="(max-width: 640px) 150px, 260px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${hsl(hue, 60, 22)}, ${hsl(hue, 70, 8)})`,
            }}
          />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2">
        <p
          className={`marquee-title uppercase text-ink line-clamp-2 ${
            active
              ? "text-lg sm:text-xl leading-tight"
              : "text-[7.5px] sm:text-[9px] leading-[1.15] tracking-tight"
          }`}
        >
          {character.name}
        </p>
        <p
          className={`text-ink/60 truncate ${active ? "text-xs mt-0.5" : "text-[7px] sm:text-[8px]"}`}
        >
          {ARCHETYPE_LABEL[character.archetype]}
        </p>
      </div>
    </Link>
  );
}
