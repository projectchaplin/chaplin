"use client";

import { useEffect, useMemo, useState } from "react";
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
  objective: string;
  action: string;
  lines: DraftLine[];
}

type WritingFormat = "story" | "ad" | "reel";

type MagicDraft = {
  title: string;
  logline: string;
  creativeDirection: string;
  castIds: string[];
  scenes: DraftScene[];
};

const IDEA_STARTERS: Record<WritingFormat, string[]> = {
  story: [
    "A simple job becomes a moral choice before dawn",
    "Two rivals must protect the same secret",
    "A comic mistake exposes a dangerous truth",
  ],
  ad: [
    "Make one product benefit impossible to forget",
    "Show the problem and transformation in one visual move",
    "Turn a customer doubt into visible proof",
  ],
  reel: [
    "Open with a pattern-break and land one punchline",
    "A before-and-after reveal made for vertical video",
    "One character challenge, one surprising payoff",
  ],
};

const EMPTY_SCENE: DraftScene = { setting: "", objective: "", action: "", lines: [] };

export default function StoryBuilderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const world = useChaplinStore((s) => s);
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const addStory = useChaplinStore((s) => s.addStory);

  const [format, setFormat] = useState<WritingFormat>(() => {
    const requested = searchParams.get("format");
    return requested === "ad" || requested === "reel" ? requested : "story";
  });
  const [durationSeconds, setDurationSeconds] = useState(() => searchParams.get("format") === "ad" ? 30 : 60);
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");
  const [castQuery, setCastQuery] = useState("");
  const [castIds, setCastIds] = useState<string[]>(() => {
    const preset = searchParams.getAll("cast");
    return preset.filter((id) => world.characters.some((c) => c.id === id));
  });
  const [scenes, setScenes] = useState<DraftScene[]>([{ ...EMPTY_SCENE }]);
  const [error, setError] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicMessage, setMagicMessage] = useState("");
  const [claudeConfigured, setClaudeConfigured] = useState<boolean | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    fetch("/api/write/magic", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setClaudeConfigured(Boolean(data.configured)))
      .catch(() => setClaudeConfigured(false));
  }, []);

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
    setScenes((prev) => [...prev, { ...EMPTY_SCENE }]);
  }
  function removeScene(i: number) {
    setScenes((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateSceneSetting(i: number, value: string) {
    setScenes((prev) => prev.map((sc, idx) => (idx === i ? { ...sc, setting: value } : sc)));
  }
  function updateScene(i: number, patch: Partial<DraftScene>) {
    setScenes((prev) => prev.map((scene, index) => (index === i ? { ...scene, ...patch } : scene)));
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

  async function createMagicDraft() {
    setMagicBusy(true);
    setError("");
    setMagicMessage("");
    try {
      const response = await fetch("/api/write/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          durationSeconds,
          brief,
          title,
          logline,
          castIds,
          characters: world.characters.map((character) => ({
            id: character.id,
            name: character.name,
            archetype: character.archetype,
            tagline: character.tagline,
            personality: character.personality,
            voiceGender: character.voiceGender,
            voiceDesc: character.voiceDesc,
            productionBible: character.productionBible,
          })),
        }),
      });
      const data = await response.json() as {
        draft?: MagicDraft;
        provider?: string;
        error?: string;
        configured?: boolean;
        warning?: string;
      };
      if (!response.ok || !data.draft) throw new Error(data.error || "Magic Writer could not build this draft.");
      const draft = data.draft;
      setTitle(draft.title);
      setLogline(draft.logline);
      setCreativeDirection(draft.creativeDirection);
      setCastIds(draft.castIds.filter((id) => world.characters.some((character) => character.id === id)));
      setScenes(draft.scenes.length ? draft.scenes : [{ ...EMPTY_SCENE }]);
      setStep(3);
      setClaudeConfigured(Boolean(data.configured));
      setMagicMessage(
        data.warning || (data.provider === "anthropic"
          ? "Claude expanded your input into a complete, editable production draft."
          : "A complete local draft is ready. Add your Claude key for deeper character-aware variations.")
      );
    } catch (magicError) {
      setError(magicError instanceof Error ? magicError.message : "Magic Writer failed.");
    } finally {
      setMagicBusy(false);
    }
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
        objective: sc.objective.trim() || undefined,
        action: sc.action.trim() || undefined,
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
      format,
      durationSeconds,
      creativeDirection: creativeDirection.trim() || undefined,
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
          AI Writing Room
        </p>
        <h1 className="reel-title text-3xl">From one spark to a shootable script</h1>
      </div>

      <section className="poster-card rounded-md p-5 mb-6 border border-accent/40 bg-accent/[0.04]" data-magic-writer>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">✦ Magic Writer</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${
                  claudeConfigured ? "border-emerald-500/50 text-emerald-500" : "border-line text-grey"
                }`}>
                  {claudeConfigured === null ? "Checking AI" : claudeConfigured ? "Claude connected" : "Local mode"}
                </span>
              </div>
              <p className="text-xs text-grey mt-1 max-w-xl">
                Give us one thought, a product, a character idea, or nothing at all. Magic Writer expands it into cast, structure, visual action, and dialogue.
              </p>
            </div>
            <div className="flex rounded-full border border-line bg-paper p-1">
              {(["story", "ad", "reel"] as WritingFormat[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setFormat(option);
                    setDurationSeconds(option === "story" ? 60 : option === "ad" ? 30 : 15);
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    format === option ? "bg-accent text-paper" : "text-grey hover:text-ink"
                  }`}
                  data-writing-format={option}
                  aria-pressed={format === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={3}
            placeholder={format === "story"
              ? "e.g. Lightning Raju loses his powers during the one rescue that matters most..."
              : "e.g. A 15-second launch ad for a fast delivery app, funny but premium..."}
            className="w-full border border-line rounded-sm bg-paper px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-accent"
            data-magic-brief
          />

          <div className="flex flex-wrap gap-2" aria-label="Idea starters">
            {IDEA_STARTERS[format].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setBrief((current) => current ? `${current} ${idea}.` : idea)}
                className="rounded-full border border-line px-3 py-1.5 text-[10px] text-grey hover:border-accent hover:text-accent"
              >
                + {idea}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-grey">
              Runtime
              <select
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(Number(event.target.value))}
                className="rounded-sm border border-line bg-paper px-2 py-1.5 text-ink"
              >
                {[5, 10, 15, 30, 60, 90, 120].map((seconds) => (
                  <option key={seconds} value={seconds}>{seconds} sec</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={createMagicDraft}
              disabled={magicBusy || world.characters.length === 0}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper shadow-[0_0_24px_rgba(244,70,112,0.25)] hover:bg-accent-light disabled:opacity-50"
              data-action="magic-script"
            >
              {magicBusy ? "Writing the draft..." : "✦ Magic: write everything"}
            </button>
          </div>
          {magicMessage && <p className="text-xs text-emerald-500">{magicMessage}</p>}
        </div>
      </section>

      <div className="flex gap-2 mb-6 text-xs">
        {(
          [
            [1, "Concept"],
            [2, "Cast"],
            [3, "Script"],
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
              placeholder={format === "story" ? "e.g. The Last Reel at Midnight" : "e.g. One Tap Ahead"}
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent"
              data-script-field="title"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Logline</span>
            <textarea
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              rows={2}
              placeholder={format === "story" ? "One or two sentences that sell the story" : "The audience, promise, and dramatic idea in one sentence"}
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
              data-script-field="logline"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Creative direction</span>
            <textarea
              value={creativeDirection}
              onChange={(event) => setCreativeDirection(event.target.value)}
              rows={3}
              placeholder="Tone, visual language, structure, and what the audience should feel"
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
              data-script-field="creative-direction"
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
                  data-scene-setting={si}
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

              <div className="grid gap-3 mb-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-grey">Scene objective</span>
                  <input
                    value={scene.objective}
                    onChange={(event) => updateScene(si, { objective: event.target.value })}
                    placeholder="What must change in this scene?"
                    className="border border-line rounded-sm bg-paper px-3 py-2 text-xs focus:outline-none focus:border-accent"
                    data-scene-objective={si}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-grey">Visible action</span>
                  <textarea
                    value={scene.action}
                    onChange={(event) => updateScene(si, { action: event.target.value })}
                    rows={2}
                    placeholder="Only what the camera and microphone can capture"
                    className="border border-line rounded-sm bg-paper px-3 py-2 text-xs resize-none focus:outline-none focus:border-accent"
                    data-scene-action={si}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3">
                {scene.lines.map((line, li) => (
                  <div key={li} className="flex flex-col gap-2 items-stretch sm:flex-row sm:items-start">
                    <select
                      value={line.characterId}
                      onChange={(e) => updateLine(si, li, { characterId: e.target.value })}
                      className="w-full border border-line rounded-sm px-2 py-2 text-sm bg-paper focus:outline-none focus:border-accent shrink-0 sm:w-36"
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
                      className="w-full min-w-0 flex-1 border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => removeLine(si, li)}
                      className="self-end text-grey hover:text-red-600 px-2 py-2 sm:self-auto"
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
              Publish the {format}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
