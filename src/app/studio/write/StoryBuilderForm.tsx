"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import {
  ARCHETYPE_HUE,
  ARCHETYPE_LABEL,
  LICENSE_HUE,
  LICENSE_LABEL,
  money,
} from "@/lib/format";

interface DraftLine {
  characterId: string;
  text: string;
}
interface DraftScene {
  setting: string;
  lines: DraftLine[];
}

export default function StoryBuilderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const world = useChaplinStore((s) => s);
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const addStory = useChaplinStore((s) => s.addStory);

  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [castQuery, setCastQuery] = useState("");
  const [castIds, setCastIds] = useState<string[]>(() => {
    const preset = searchParams.getAll("cast");
    return preset.filter((id) => world.characters.some((c) => c.id === id));
  });
  const [scenes, setScenes] = useState<DraftScene[]>([{ setting: "", lines: [] }]);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const castCharacters = castIds
    .map((id) => world.characters.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const totalFee = castCharacters.reduce(
    (sum, c) => sum + (c.licenseType === "open" ? 0 : c.royaltyRate),
    0
  );

  const searchResults = useMemo(() => {
    const q = castQuery.trim().toLowerCase();
    if (!q) return world.characters;
    return world.characters.filter(
      (c) => c.name.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q)
    );
  }, [world.characters, castQuery]);

  function toggleCast(id: string) {
    setCastIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addScene() {
    setScenes((prev) => [...prev, { setting: "", lines: [] }]);
  }
  function removeScene(i: number) {
    setScenes((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateSceneSetting(i: number, value: string) {
    setScenes((prev) => prev.map((sc, idx) => (idx === i ? { ...sc, setting: value } : sc)));
  }
  function addLine(sceneIdx: number) {
    setScenes((prev) =>
      prev.map((sc, idx) =>
        idx === sceneIdx
          ? { ...sc, lines: [...sc.lines, { characterId: castIds[0] ?? "", text: "" }] }
          : sc
      )
    );
  }
  function removeLine(sceneIdx: number, lineIdx: number) {
    setScenes((prev) =>
      prev.map((sc, idx) =>
        idx === sceneIdx ? { ...sc, lines: sc.lines.filter((_, li) => li !== lineIdx) } : sc
      )
    );
  }
  function updateLine(sceneIdx: number, lineIdx: number, patch: Partial<DraftLine>) {
    setScenes((prev) =>
      prev.map((sc, idx) =>
        idx === sceneIdx
          ? {
              ...sc,
              lines: sc.lines.map((ln, li) => (li === lineIdx ? { ...ln, ...patch } : ln)),
            }
          : sc
      )
    );
  }

  function handlePublish() {
    if (!title.trim() || !logline.trim()) {
      setError("Give the story a title and a logline first.");
      setStep(1);
      return;
    }
    if (castCharacters.length === 0) {
      setError("Cast at least one character before you publish.");
      setStep(2);
      return;
    }
    const validScenes = scenes
      .map((sc) => ({
        setting: sc.setting.trim() || "An unnamed scene",
        lines: sc.lines.filter((ln) => ln.characterId && ln.text.trim()),
      }))
      .filter((sc) => sc.lines.length > 0);

    if (validScenes.length === 0) {
      setError("Write at least one scene with a line of dialogue.");
      setStep(3);
      return;
    }

    const story = addStory({
      title: title.trim(),
      logline: logline.trim(),
      authorId: currentUserId,
      coverHue: castCharacters[0]?.avatarHue ?? 205,
      castCharacterIds: castIds,
      scenes: validScenes,
    });
    router.push(`/stories/${story.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 w-full">
      <Link href="/stories" className="text-xs text-grey hover:text-accent">
        ← Stories
      </Link>

      <div className="mt-3 mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
          Story Builder
        </p>
        <h1 className="reel-title text-3xl">Cast a crew, write the scene</h1>
      </div>

      <div className="flex gap-2 mb-6 text-xs">
        {(
          [
            [1, "Title"],
            [2, "Cast"],
            [3, "Scenes"],
          ] as const
        ).map(([n, label]) => (
          <button
            key={n}
            onClick={() => setStep(n)}
            className={`px-3 py-1.5 rounded-full border ${
              step === n ? "border-accent text-ink font-semibold bg-accent/10" : "border-line text-grey"
            }`}
          >
            {n}. {label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="poster-card rounded-md p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Last Reel at Midnight"
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Logline</span>
            <textarea
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              rows={2}
              placeholder="One or two sentences that sell the story"
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
            />
          </label>
          <button
            onClick={() => setStep(2)}
            className="self-end bg-accent text-paper font-semibold px-4 py-2 rounded-sm hover:bg-accent-light transition-colors"
          >
            Next: cast your story →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          {castCharacters.length > 0 && (
            <div className="poster-card rounded-md p-4">
              <p className="text-[11px] uppercase tracking-wide text-grey mb-2">
                Your cast ({castCharacters.length})
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {castCharacters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCast(c.id)}
                    className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border border-accent bg-accent/10 text-xs"
                  >
                    <Avatar hue={c.avatarHue} label={c.name} src={c.imageUrl} size={20} />
                    {c.name}
                    <span className="text-grey">✕</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-grey">
                Total casting fee: {totalFee > 0 ? money(totalFee) : "free, all open license"}
              </p>
            </div>
          )}

          <div className="poster-card rounded-md p-4">
            <input
              value={castQuery}
              onChange={(e) => setCastQuery(e.target.value)}
              placeholder="Search the shelf…"
              className="w-full bg-paper border border-line rounded-sm px-3 py-2 text-sm mb-3 focus:outline-none focus:border-accent"
            />
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
              {searchResults.map((c) => {
                const selected = castIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCast(c.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-md border text-left transition-colors ${
                      selected ? "border-accent bg-accent/10" : "border-line hover:border-accent"
                    }`}
                  >
                    <Avatar hue={c.avatarHue} label={c.name} src={c.imageUrl} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-grey truncate italic">&ldquo;{c.tagline}&rdquo;</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Chip label={ARCHETYPE_LABEL[c.archetype]} hue={ARCHETYPE_HUE[c.archetype]} />
                        <Chip label={LICENSE_LABEL[c.licenseType]} hue={LICENSE_HUE[c.licenseType]} />
                      </div>
                    </div>
                    <div className="text-xs text-right shrink-0 text-grey">
                      {c.licenseType === "open" && "free"}
                      {c.licenseType === "paid" && money(c.royaltyRate)}
                      {c.licenseType === "approval" && (
                        <span>
                          {money(c.royaltyRate)}
                          <br />
                          <span className="text-accent">once approved</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-grey hover:text-accent px-4 py-2"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="bg-accent text-paper font-semibold px-4 py-2 rounded-sm hover:bg-accent-light transition-colors"
            >
              Next: write scenes →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-6">
          {castCharacters.length === 0 && (
            <div className="poster-card rounded-md p-4 text-sm text-grey">
              You haven&apos;t cast anyone yet,{" "}
              <button onClick={() => setStep(2)} className="text-accent hover:underline">
                go back and pick your cast
              </button>
              .
            </div>
          )}

          {scenes.map((scene, si) => (
            <div key={si} className="poster-card rounded-md p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="accent-rule w-6" />
                <input
                  value={scene.setting}
                  onChange={(e) => updateSceneSetting(si, e.target.value)}
                  placeholder={`Scene ${si + 1} setting: e.g. A rain-slicked rooftop`}
                  className="flex-1 text-xs uppercase tracking-wide bg-transparent border-b border-line px-1 py-1 focus:outline-none focus:border-accent"
                />
                {scenes.length > 1 && (
                  <button
                    onClick={() => removeScene(si)}
                    className="text-xs text-grey hover:text-red-600"
                  >
                    Remove scene
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {scene.lines.map((line, li) => (
                  <div key={li} className="flex gap-2 items-start">
                    <select
                      value={line.characterId}
                      onChange={(e) => updateLine(si, li, { characterId: e.target.value })}
                      className="border border-line rounded-sm px-2 py-2 text-sm bg-paper focus:outline-none focus:border-accent shrink-0 w-36"
                    >
                      <option value="">Who speaks?</option>
                      {castCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={line.text}
                      onChange={(e) => updateLine(si, li, { text: e.target.value })}
                      placeholder="Their line…"
                      className="flex-1 border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => removeLine(si, li)}
                      className="text-grey hover:text-red-600 px-2 py-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addLine(si)}
                  disabled={castCharacters.length === 0}
                  className="text-xs text-accent hover:underline self-start disabled:text-grey disabled:no-underline"
                >
                  + Add a line
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addScene}
            className="border border-dashed border-line rounded-md py-3 text-sm text-grey hover:border-accent hover:text-accent transition-colors"
          >
            + Add another scene
          </button>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="text-sm text-grey hover:text-accent px-4 py-2"
            >
              ← Back
            </button>
            <button
              onClick={handlePublish}
              className="bg-accent text-paper font-semibold px-6 py-2.5 rounded-sm hover:bg-accent-light transition-colors"
            >
              Publish the story
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
