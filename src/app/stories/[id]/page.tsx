"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useChaplinStore } from "@/lib/store";
import { getStory, getUser, castForStory } from "@/lib/selectors";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import SoundtrackBar from "@/components/SoundtrackBar";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, compactNumber, formatDate } from "@/lib/format";

export default function StoryPlayerPage() {
  const params = useParams<{ id: string }>();
  const world = useChaplinStore((s) => s);
  const story = getStory(world, params.id);

  if (!story) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-grey mb-4">This story isn&apos;t showing anywhere (yet).</p>
        <Link href="/stories" className="text-accent hover:underline">
          ← Back to Stories
        </Link>
      </div>
    );
  }

  const author = getUser(world, story.authorId);
  const cast = castForStory(world, story.id);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 w-full">
      <Link href="/stories" className="text-xs text-grey hover:text-accent">
        ← Stories
      </Link>

      <div className="mt-3 mb-6 flex flex-col sm:flex-row gap-5">
        {story.posterUrl && (
          <div className="relative w-40 sm:w-48 aspect-[2/3] shrink-0 rounded-md overflow-hidden poster-card mx-auto sm:mx-0">
            <Image
              src={story.posterUrl}
              alt={story.title}
              fill
              sizes="192px"
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
            Now Showing
          </p>
          <h1 className="reel-title text-3xl sm:text-4xl mb-2">{story.title}</h1>
          <p className="text-grey text-sm mb-2">{story.logline}</p>
          {(story.format || story.durationSeconds) && (
            <p className="text-[10px] uppercase tracking-[0.16em] text-accent mb-2">
              {story.format ?? "story"}{story.durationSeconds ? ` · ${story.durationSeconds} sec` : ""}
            </p>
          )}
          <p className="text-xs text-grey">
            Written by{" "}
            {author ? (
              <Link href="/studio" className="text-accent hover:underline">
                {author.name}
              </Link>
            ) : (
              "unknown"
            )}{" "}
            · {formatDate(story.createdAt)} · {compactNumber(story.views)} views
          </p>
        </div>
      </div>

      <SoundtrackBar title={`${story.title}: Original Score`} />

      {/* Cast strip */}
      <div className="poster-card rounded-md p-4 my-6">
        <p className="text-[11px] uppercase tracking-wide text-grey mb-3">Starring</p>
        <div className="flex flex-wrap gap-3">
          {cast.map(({ character }) => (
            <Link
              key={character.id}
              href={`/characters/${character.id}`}
              className="flex items-center gap-2 pr-3 rounded-full border border-line hover:border-accent transition-colors"
            >
              <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={30} />
              <span className="text-sm font-medium">{character.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {story.creativeDirection && (
        <section className="poster-card rounded-md p-5 mb-8">
          <p className="text-[10px] uppercase tracking-[0.15em] text-grey mb-1">Creative direction</p>
          <p className="text-sm leading-relaxed">{story.creativeDirection}</p>
        </section>
      )}

      {/* Scenes */}
      <div className="flex flex-col gap-8">
        {story.scenes.map((scene, si) => (
          <div key={scene.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="accent-rule w-6" />
              <p className="text-xs uppercase tracking-[0.15em] text-grey">
                Scene {si + 1} · {scene.setting}
              </p>
            </div>

            {(scene.objective || scene.action) && (
              <div className="poster-card rounded-md p-4 mb-4 grid gap-3 sm:grid-cols-2">
                {scene.objective && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-grey mb-1">Objective</p>
                    <p className="text-xs leading-relaxed">{scene.objective}</p>
                  </div>
                )}
                {scene.action && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-grey mb-1">Visible action</p>
                    <p className="text-xs leading-relaxed">{scene.action}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {scene.lines.map((line) => {
                const character = cast.find((r) => r.character.id === line.characterId)?.character;
                if (!character) return null;
                return (
                  <div key={line.id} className="flex gap-3">
                    <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/characters/${character.id}`}
                          className="text-sm font-semibold hover:text-accent"
                        >
                          {character.name}
                        </Link>
                        <Chip
                          label={ARCHETYPE_LABEL[character.archetype]}
                          hue={ARCHETYPE_HUE[character.archetype]}
                        />
                      </div>
                      <div className="poster-card rounded-md rounded-tl-none px-4 py-2.5 inline-block max-w-full">
                        <p className="text-sm leading-relaxed">{line.text}</p>
                      </div>
                      <div className="mt-1.5">
                        <Link
                          href={`/characters/${character.id}#sound-profile`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-grey hover:border-accent hover:text-accent"
                        >
                          ▶ Hear character voice
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer cast, reuse CTA */}
      <div className="poster-card rounded-md p-5 mt-10">
        <p className="text-sm font-semibold mb-1">Liked this cast?</p>
        <p className="text-xs text-grey mb-4">
          Every character above is on the shelf, ready to be cast into your own story.
        </p>
        <div className="flex flex-wrap gap-2">
          {cast.map(({ character }) => (
            <Link
              key={character.id}
              href={`/studio/write?cast=${character.id}`}
              className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
            >
              Cast {character.name.split(" ")[0]} too →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
