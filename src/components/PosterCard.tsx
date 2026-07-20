import Link from "next/link";
import Image from "next/image";
import type { Story, Character } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { hsl, compactNumber } from "@/lib/format";

export default function PosterCard({
  story,
  cast,
  authorName,
  isNew = false,
}: {
  story: Story;
  cast: Character[];
  authorName?: string;
  isNew?: boolean;
}) {
  return (
    <Link
      href={`/stories/${story.id}`}
      className="group/poster relative shrink-0 snap-start w-60 sm:w-72 h-36 sm:h-44 rounded-md overflow-hidden border border-line block transition-transform duration-200 hover:scale-[1.05] hover:z-10 hover:shadow-xl"
    >
      <div className="absolute inset-0">
        {story.backdropUrl ? (
          <Image
            src={story.backdropUrl}
            alt={story.title}
            fill
            sizes="(max-width: 640px) 240px, 288px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${hsl(story.coverHue, 78, 32)}, ${hsl(
                story.coverHue,
                85,
                10
              )})`,
            }}
          />
        )}
      </div>

      {!story.backdropUrl && (
        <div
          className="absolute inset-0 mix-blend-overlay opacity-60"
          style={{
            background: `radial-gradient(120% 90% at 15% 10%, ${hsl(story.coverHue, 90, 65)}, transparent 60%)`,
          }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />

      {isNew && (
        <span className="absolute top-2 left-2 bg-accent text-paper text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm">
          New
        </span>
      )}

      <span className="absolute top-2 right-2 text-[10px] text-ink/85 bg-black/45 rounded-full px-2 py-0.5">
        {compactNumber(story.views)} views
      </span>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="marquee-title text-ink text-lg sm:text-xl leading-tight uppercase line-clamp-2 drop-shadow-md">
          {story.title}
        </p>
        <p className="text-[11px] text-ink/75 mt-0.5 line-clamp-1 max-h-0 opacity-0 group-hover/poster:max-h-6 group-hover/poster:opacity-100 transition-all duration-200">
          {story.logline}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex -space-x-2">
            {cast.slice(0, 3).map((c) => (
              <span key={c.id} className="ring-2 ring-black/50 rounded-full">
                <Avatar hue={c.avatarHue} label={c.name} src={c.imageUrl} size={22} />
              </span>
            ))}
          </div>
          {authorName && (
            <span className="text-[10px] text-ink/65 truncate">by {authorName}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
