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
  const hasPoster = Boolean(story.posterUrl);
  const image = story.posterUrl ?? story.backdropUrl;

  return (
    <Link
      href={`/stories/${story.id}`}
      className="group/poster relative shrink-0 snap-start w-36 sm:w-44 aspect-[2/3] rounded-md overflow-hidden border border-line block transition-transform duration-200 hover:scale-[1.05] hover:z-10 hover:shadow-xl"
    >
      <div className="absolute inset-0">
        {image ? (
          <Image
            src={image}
            alt={story.title}
            fill
            sizes="(max-width: 640px) 144px, 176px"
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

      {!image && (
        <div
          className="absolute inset-0 mix-blend-overlay opacity-60"
          style={{
            background: `radial-gradient(120% 90% at 15% 10%, ${hsl(story.coverHue, 90, 65)}, transparent 60%)`,
          }}
        />
      )}

      {/* scrim + text overlay only when there's no finished poster art to protect */}
      {!hasPoster && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-2.5">
            <p className="marquee-title text-ink text-sm sm:text-base leading-tight uppercase line-clamp-3 drop-shadow-md">
              {story.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex -space-x-2">
                {cast.slice(0, 3).map((c) => (
                  <span key={c.id} className="ring-2 ring-black/50 rounded-full">
                    <Avatar hue={c.avatarHue} label={c.name} src={c.imageUrl} size={18} />
                  </span>
                ))}
              </div>
              {authorName && (
                <span className="text-[9px] text-ink/65 truncate">by {authorName}</span>
              )}
            </div>
          </div>
        </>
      )}

      {isNew && (
        <span className="absolute top-1.5 left-1.5 bg-accent text-paper text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm">
          New
        </span>
      )}

      <span className="absolute top-1.5 right-1.5 text-[9px] text-ink/85 bg-black/45 rounded-full px-1.5 py-0.5">
        {compactNumber(story.views)}
      </span>
    </Link>
  );
}
