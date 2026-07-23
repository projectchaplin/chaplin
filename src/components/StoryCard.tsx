import Link from "next/link";
import type { Character, Story } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { hsl, compactNumber } from "@/lib/format";

export default function StoryCard({
  story,
  cast,
  authorName,
}: {
  story: Story;
  cast: Character[];
  authorName?: string;
}) {
  const lineCount = story.scenes.reduce((n, sc) => n + sc.lines.length, 0);

  return (
    <Link
      href={(story.status ?? "published") === "production" ? `/productions/${story.id}` : `/stories/${story.id}`}
      className="poster-card rounded-md overflow-hidden flex flex-col h-full"
    >
      <div
        className="h-20 flex items-end px-4 pb-2"
        style={{
          background: `linear-gradient(135deg, ${hsl(story.coverHue, 78, 28)}, ${hsl(story.coverHue, 85, 9)})`,
          borderBottom: `2px solid ${hsl(story.coverHue, 70, 50)}`,
        }}
      >
        <span className="text-[11px] uppercase tracking-widest text-ink/70">
          {(story.status ?? "published") === "production" ? "IN PRODUCTION · " : ""}{story.scenes.length} beats · {lineCount} lines
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="reel-title text-xl leading-tight">{story.title}</h3>
          {authorName && <p className="text-[11px] text-grey mt-0.5">by {authorName}</p>}
        </div>
        <p className="text-sm text-grey leading-snug flex-1">{story.logline}</p>

        <div className="flex items-center justify-between border-t border-line pt-2">
          <div className="flex -space-x-2">
            {cast.slice(0, 4).map((c) => (
              <span key={c.id} className="ring-2 ring-paper-dim rounded-full">
                <Avatar hue={c.avatarHue} label={c.name} src={c.imageUrl} size={26} />
              </span>
            ))}
            {cast.length > 4 && (
              <span className="ring-2 ring-paper-dim rounded-full w-[26px] h-[26px] flex items-center justify-center bg-paper text-[10px] text-grey">
                +{cast.length - 4}
              </span>
            )}
          </div>
          <span className="text-xs text-grey">
            {(story.status ?? "published") === "production" ? `${story.durationSeconds ?? 0}s output` : `${compactNumber(story.views)} views`}
          </span>
        </div>
      </div>
    </Link>
  );
}
