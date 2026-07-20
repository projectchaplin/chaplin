import Link from "next/link";
import Image from "next/image";
import type { Character } from "@/lib/types";
import { ARCHETYPE_LABEL, ARCHETYPE_HUE, hsl } from "@/lib/format";

export default function HeroGridCard({
  character,
  featured = false,
}: {
  character: Character;
  featured?: boolean;
}) {
  const hue = ARCHETYPE_HUE[character.archetype];

  return (
    <Link
      href={`/characters/${character.id}`}
      className={`group relative overflow-hidden rounded-lg block ${
        featured ? "col-span-2 row-span-2" : ""
      }`}
      style={
        featured
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
            sizes={featured ? "260px" : "130px"}
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
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p
          className={`marquee-title uppercase leading-tight text-ink truncate ${
            featured ? "text-lg sm:text-xl" : "text-[10px] sm:text-[11px]"
          }`}
        >
          {character.name}
        </p>
        <p className={`text-ink/60 truncate ${featured ? "text-xs" : "text-[9px]"}`}>
          {ARCHETYPE_LABEL[character.archetype]}
        </p>
      </div>
    </Link>
  );
}
