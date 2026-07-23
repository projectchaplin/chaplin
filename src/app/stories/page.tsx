"use client";

import { useMemo, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import { castForStory, getUser } from "@/lib/selectors";
import PosterCard from "@/components/PosterCard";
import Carousel from "@/components/Carousel";
import SectionHeading from "@/components/SectionHeading";
import type { Story } from "@/lib/types";

export default function StoriesPage() {
  const world = useChaplinStore((s) => s);
  const [query, setQuery] = useState("");

  const searching = query.trim().length > 0;

  const matches = useMemo(() => {
    if (!searching) return [];
    const q = query.trim().toLowerCase();
    return [...world.stories]
      .filter((story) => (story.status ?? "published") === "published")
      .filter((s) => s.title.toLowerCase().includes(q) || s.logline.toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [world.stories, query, searching]);

  const nowShowing = useMemo(
    () => [...world.stories].filter((story) => (story.status ?? "published") === "published").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [world.stories]
  );

  const mostWatched = useMemo(
    () => [...world.stories].filter((story) => (story.status ?? "published") === "published").sort((a, b) => b.views - a.views),
    [world.stories]
  );

  const villainSpotlight = useMemo(() => {
    return [...world.stories]
      .filter((story) => (story.status ?? "published") === "published")
      .filter((s) => castForStory(world, s.id).some((r) => r.character.archetype === "villain"))
      .sort((a, b) => b.views - a.views);
  }, [world]);

  const newestId = nowShowing[0]?.id;

  function renderPoster(story: Story) {
    const cast = castForStory(world, story.id).map((r) => r.character);
    const author = getUser(world, story.authorId);
    return (
      <PosterCard
        key={story.id}
        story={story}
        cast={cast}
        authorName={author?.name}
        isNew={story.id === newestId}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      <SectionHeading eyebrow="Now Showing" title="Every story on Project Chaplin" />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stories by title or logline…"
        className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-sm mb-8 focus:outline-none focus:border-accent"
      />

      {searching ? (
        matches.length === 0 ? (
          <div className="poster-card rounded-md p-10 text-center text-grey">
            No story matches yet, someone should write one.
          </div>
        ) : (
          <>
            <p className="text-xs text-grey mb-3">
              {matches.length} stor{matches.length === 1 ? "y" : "ies"} matching &ldquo;{query.trim()}&rdquo;
            </p>
            <div className="flex flex-wrap gap-4">{matches.map(renderPoster)}</div>
          </>
        )
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="reel-title text-xl mb-3">Now Showing</h2>
            <Carousel>{nowShowing.map(renderPoster)}</Carousel>
          </section>

          <section>
            <h2 className="reel-title text-xl mb-3">Most Watched</h2>
            <Carousel>{mostWatched.map(renderPoster)}</Carousel>
          </section>

          {villainSpotlight.length > 0 && (
            <section>
              <h2 className="reel-title text-xl mb-3">Villain Spotlight</h2>
              <Carousel>{villainSpotlight.map(renderPoster)}</Carousel>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
