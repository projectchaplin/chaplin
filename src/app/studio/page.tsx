"use client";

import { useEffect, useState } from "react";
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

type Tab = "drafts" | "characters" | "stories" | "earnings";

type DraftSummary = {
  id: string;
  format: "spark" | "punch" | "episode" | "spot";
  title: string;
  logline: string;
  updated_at: string;
};

export default function StudioPage() {
  const world = useChaplinStore((s) => s);
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const [tab, setTab] = useState<Tab>("drafts");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsNeedLogin, setDraftsNeedLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/drafts", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { drafts?: DraftSummary[] };
        if (cancelled) return;
        if (response.status === 401) setDraftsNeedLogin(true);
        else if (response.ok) setDrafts(data.drafts ?? []);
      })
      .finally(() => { if (!cancelled) setDraftsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const user = getUser(world, currentUserId);
  const myCharacters = charactersByMaker(world, currentUserId);
  const myStories = storiesByAuthor(world, currentUserId);
  const myLedger = ledgerForMaker(world, currentUserId);
  const earnings = makerEarnings(world, currentUserId);
  const totalCastings = myCharacters.reduce((n, c) => n + c.stats.castings, 0);
  const totalFans = myCharacters.reduce((n, c) => n + c.stats.fans, 0);

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

      <Link
        href="/studio/pipelines"
        className="poster-card mb-6 flex items-center justify-between gap-4 rounded-md p-4 hover:border-accent"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Production system</p>
          <p className="mt-1 text-sm font-semibold">See every image, shot, video, audio, and delivery pipeline</p>
        </div>
        <span className="text-accent">→</span>
      </Link>

      <div className="flex gap-2 mb-6 text-sm">
        {(
          [
            ["drafts", `Drafts (${drafts.length})`],
            ["characters", `My identities (${myCharacters.length})`],
            ["stories", `My scenes (${myStories.length})`],
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

      {tab === "drafts" && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="reel-title text-2xl">Continue where you stopped</h2>
              <p className="mt-1 text-xs text-grey">Private, account-owned work automatically saved from the writing room.</p>
            </div>
            <Link href="/studio/write" className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">
              + New draft
            </Link>
          </div>
          {draftsLoading ? (
            <div className="poster-card rounded-md p-10 text-center text-sm text-grey">Loading your drafts…</div>
          ) : draftsNeedLogin ? (
            <div className="poster-card rounded-md p-10 text-center">
              <p className="text-sm font-semibold">Sign in to keep drafts private and available on every device.</p>
              <Link href="/auth?next=/studio" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Create creator account</Link>
            </div>
          ) : drafts.length === 0 ? (
            <Link href="/studio/write" className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line p-6 text-grey transition-colors hover:border-accent hover:text-accent">
              <span className="text-2xl">+</span>
              <span className="text-sm">Start your first Spark, Punch, Episode, or Spot</span>
            </Link>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => (
                <Link key={draft.id} href={`/studio/write?format=${draft.format}&draft=${draft.id}`} className="poster-card rounded-md p-5 hover:border-accent">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      {draft.format === "episode" ? "Episode · 60s" : draft.format === "punch" ? "Punch · 15s" : draft.format === "spark" ? "Spark · 5s" : "Brand Spot"}
                    </span>
                    <span className="text-[10px] text-grey">{new Date(draft.updated_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{draft.title || "Untitled draft"}</h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-grey">{draft.logline || "Open this draft and continue writing."}</p>
                  <span className="mt-5 block text-xs font-semibold text-accent">Continue →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

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
            <span className="text-sm">Start a new production</span>
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
