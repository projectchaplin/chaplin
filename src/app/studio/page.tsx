"use client";

import { useState } from "react";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import {
  charactersByMaker,
  storiesByAuthor,
  ledgerForMaker,
  makerEarnings,
  castForStory,
  getUser,
  getCharacter,
  getStory,
} from "@/lib/selectors";
import Avatar from "@/components/Avatar";
import CharacterCard from "@/components/CharacterCard";
import StoryCard from "@/components/StoryCard";
import SectionHeading from "@/components/SectionHeading";
import { money, formatDate, compactNumber } from "@/lib/format";

type Tab = "characters" | "stories" | "earnings";

export default function StudioPage() {
  const world = useChaplinStore((s) => s);
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const [tab, setTab] = useState<Tab>("characters");

  const user = getUser(world, currentUserId);
  const myCharacters = charactersByMaker(world, currentUserId);
  const myStories = storiesByAuthor(world, currentUserId);
  const myLedger = ledgerForMaker(world, currentUserId);
  const earnings = makerEarnings(world, currentUserId);
  const totalCastings = myCharacters.reduce((n, c) => n + c.stats.castings, 0);
  const totalFans = myCharacters.reduce((n, c) => n + c.stats.fans, 0);

  if (world.activeRole === "caster" || world.activeRole === "brand") {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center w-full">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-2">{world.activeRole === "brand" ? "Brand workspace" : "Caster workspace"}</p>
        <h1 className="reel-title text-3xl">{world.activeRole === "brand" ? "Choose an actor for your next ad or reel" : "Cast actors into your next story"}</h1>
        <p className="text-sm text-grey mt-3 mb-6">Maker production tools and earnings stay private while you cast.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/characters" className="border border-line rounded-full px-5 py-2.5 text-sm hover:border-accent">Browse actors</Link>
          <Link href="/studio/write" className="accent-btn rounded-full px-5 py-2.5 text-sm font-semibold">Write a story</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="flex items-center gap-4 mb-8">
        {user && (
          <span className="accent-ring shrink-0">
            <Avatar hue={user.avatarHue} label={user.name} src={user.imageUrl} size={56} />
          </span>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
            My Studio
          </p>
          <h1 className="reel-title text-3xl">{user?.name ?? "Guest"}</h1>
          <p className="text-xs text-grey">{user?.roleBadges.join(" · ")}</p>
        </div>
        <div className="ml-auto hidden sm:flex gap-6 text-right">
          <div>
            <p className="text-xl font-semibold">{myCharacters.length}</p>
            <p className="text-[11px] text-grey uppercase tracking-wide">AI actors</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{totalCastings}</p>
            <p className="text-[11px] text-grey uppercase tracking-wide">Castings</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{compactNumber(totalFans)}</p>
            <p className="text-[11px] text-grey uppercase tracking-wide">Fans</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-accent">{money(earnings)}</p>
            <p className="text-[11px] text-grey uppercase tracking-wide">Earnings</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 text-sm">
        {(
          [
            ["characters", `My AI Actors (${myCharacters.length})`],
            ["stories", `My Stories (${myStories.length})`],
            ["earnings", `Earnings (${myLedger.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`px-4 py-2 rounded-full border transition-colors ${
              tab === key
                ? "border-accent bg-accent/10 text-ink font-semibold"
                : "border-line text-grey hover:border-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "characters" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <Link
            href="/characters/new"
            className="border border-dashed border-line rounded-md flex flex-col items-center justify-center gap-2 text-grey hover:border-accent hover:text-accent transition-colors p-6 min-h-40"
          >
            <span className="text-2xl">+</span>
            <span className="text-sm">Build a new AI actor</span>
          </Link>
          {myCharacters.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}

      {tab === "stories" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/studio/write"
            className="border border-dashed border-line rounded-md flex flex-col items-center justify-center gap-2 text-grey hover:border-accent hover:text-accent transition-colors p-6 min-h-48"
          >
            <span className="text-2xl">+</span>
            <span className="text-sm">Write a new story</span>
          </Link>
          {myStories.map((story) => {
            const cast = castForStory(world, story.id).map((r) => r.character);
            return <StoryCard key={story.id} story={story} cast={cast} />;
          })}
        </div>
      )}

      {tab === "earnings" && (
        <div>
          <SectionHeading
            eyebrow="Every reel, traced"
            title={`${money(earnings)} earned so far`}
          />
          {myLedger.length === 0 ? (
            <div className="poster-card rounded-md p-10 text-center text-grey">
              No earnings yet, cast one of your AI actors into a story to start the ledger.
            </div>
          ) : (
            <div className="poster-card rounded-md overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-grey">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">AI actor</th>
                    <th className="px-4 py-3 font-medium">Story</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {myLedger.map((entry) => {
                    const character = getCharacter(world, entry.characterId);
                    const story = getStory(world, entry.storyId);
                    return (
                      <tr key={entry.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 text-grey whitespace-nowrap">
                          {formatDate(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          {character ? (
                            <Link
                              href={`/characters/${character.id}`}
                              className="hover:text-accent font-medium"
                            >
                              {character.name}
                            </Link>
                          ) : (
                            "unknown"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {story ? (
                            <Link href={`/stories/${story.id}`} className="hover:text-accent">
                              {story.title}
                            </Link>
                          ) : (
                            "unknown"
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-grey">{entry.type}</td>
                        <td className="px-4 py-3 text-right font-semibold text-accent">
                          {money(entry.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
