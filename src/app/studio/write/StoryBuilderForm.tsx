"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  PRODUCTION_FORMATS,
  defaultFormatForRole,
  formatsForRole,
  normalizeProductionFormat,
  productionDuration,
  productionShotCount,
  type ProductionFormat,
} from "@/lib/production-formats";

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

type MagicDraft = {
  title: string;
  logline: string;
  creativeDirection: string;
  castIds: string[];
  scenes: DraftScene[];
};

type StoredDraft = {
  id: string;
  format: ProductionFormat;
  title: string;
  logline: string;
  body?: {
    brief?: string;
    durationSeconds?: number;
    creativeDirection?: string;
    castIds?: string[];
    scenes?: DraftScene[];
    step?: 1 | 2 | 3;
  };
};

type DraftSaveState = "idle" | "loading" | "saving" | "saved" | "signed-out" | "error";

const IDEA_STARTERS: Record<ProductionFormat, string[]> = {
  episode: [
    "A simple job becomes a moral choice before dawn",
    "Two rivals must protect the same secret",
    "A comic mistake exposes a dangerous truth",
  ],
  spot: [
    "Make one product benefit impossible to forget",
    "Show the problem and transformation in one visual move",
    "Turn a customer doubt into visible proof",
  ],
  punch: [
    "Open with a pattern-break and land one punchline",
    "Put the actor under pressure and reveal their signature choice",
    "One visual hook, one reversal, one unforgettable final look",
  ],
  spark: [
    "One look that tells us exactly who this actor is",
    "A five-second entrance with a visible point of view",
    "One prop, one gesture, one casting-defining choice",
  ],
};

const EMPTY_SCENE: DraftScene = { setting: "", objective: "", action: "", lines: [] };

export default function StoryBuilderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const world = useChaplinStore((s) => s);
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const activeRole = useChaplinStore((s) => s.activeRole);
  const addStory = useChaplinStore((s) => s.addStory);

  const [format, setFormat] = useState<ProductionFormat>(() =>
    normalizeProductionFormat(searchParams.get("format"), "punch")
  );
  const [durationSeconds, setDurationSeconds] = useState<number>(() =>
    productionDuration(
      normalizeProductionFormat(searchParams.get("format"), "punch"),
      Number(searchParams.get("duration")),
    )
  );
  const [brief, setBrief] = useState(() => searchParams.get("brief")?.trim() ?? "");
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
  const [draftId, setDraftId] = useState(() => searchParams.get("draft") ?? "");
  const [draftReady, setDraftReady] = useState(() => !searchParams.get("draft"));
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>(
    searchParams.get("draft") ? "loading" : "idle",
  );
  const formatOptions = formatsForRole(activeRole);
  const formatDefinition = PRODUCTION_FORMATS[format];
  const expectedShotCount = productionShotCount(format, durationSeconds);

  useEffect(() => {
    if (formatOptions.includes(format)) return;
    const nextFormat = defaultFormatForRole(activeRole);
    const timer = window.setTimeout(() => {
      setFormat(nextFormat);
      setDurationSeconds(productionDuration(nextFormat));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeRole, format, formatOptions]);

  useEffect(() => {
    const requestedDraftId = searchParams.get("draft");
    if (!requestedDraftId) return;
    let cancelled = false;
    void fetch(`/api/drafts?id=${encodeURIComponent(requestedDraftId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { draft?: StoredDraft; error?: string };
        if (!response.ok || !data.draft) throw new Error(data.error || "Could not open this draft.");
        return data.draft;
      })
      .then((stored) => {
        if (cancelled) return;
        const body = stored.body ?? {};
        setFormat(stored.format);
        setTitle(stored.title);
        setLogline(stored.logline);
        setBrief(body.brief ?? "");
        setDurationSeconds(body.durationSeconds ?? productionDuration(stored.format));
        setCreativeDirection(body.creativeDirection ?? "");
        setCastIds(Array.isArray(body.castIds) ? body.castIds : []);
        setScenes(Array.isArray(body.scenes) && body.scenes.length ? body.scenes : [{ ...EMPTY_SCENE }]);
        setStep(body.step === 2 || body.step === 3 ? body.step : 1);
        setDraftId(stored.id);
        setDraftReady(true);
        setDraftSaveState("saved");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not open this draft.");
        setDraftReady(true);
        setDraftSaveState("error");
      });
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    if (!draftReady) return;
    const hasWork = Boolean(
      brief.trim() ||
      title.trim() ||
      logline.trim() ||
      creativeDirection.trim() ||
      castIds.length ||
      scenes.some((scene) => scene.setting.trim() || scene.objective?.trim() || scene.action?.trim() || scene.lines.some((line) => line.text.trim())),
    );
    if (!hasWork) return;

    const timer = window.setTimeout(() => {
      setDraftSaveState("saving");
      void fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId || undefined,
          format,
          title,
          logline,
          body: { brief, durationSeconds, creativeDirection, castIds, scenes, step },
        }),
      })
        .then(async (response) => {
          const data = await response.json() as { draft?: StoredDraft; error?: string };
          if (response.status === 401) {
            setDraftSaveState("signed-out");
            return null;
          }
          if (!response.ok || !data.draft) throw new Error(data.error || "Draft could not be saved.");
          return data.draft;
        })
        .then((saved) => {
          if (!saved) return;
          if (!draftId) {
            setDraftId(saved.id);
            const params = new URLSearchParams(window.location.search);
            params.set("draft", saved.id);
            window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
          }
          setDraftSaveState("saved");
        })
        .catch(() => setDraftSaveState("error"));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [brief, castIds, creativeDirection, draftId, draftReady, durationSeconds, format, logline, scenes, step, title]);

  useEffect(() => {
    fetch("/api/write/magic", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setClaudeConfigured(Boolean(data.configured)))
      .catch(() => setClaudeConfigured(false));
  }, []);

  // Concierge hand-off: ?brief=…&auto=1 lands here with the draft already writing.
  const conciergeRan = useRef(false);
  useEffect(() => {
    if (conciergeRan.current) return;
    if (searchParams.get("auto") !== "1") return;
    if (brief.trim().length < 5 || world.characters.length === 0) return;
    conciergeRan.current = true;
    void createMagicDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hand-off once characters exist
  }, [world.characters.length]);

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

  function handleStartProduction() {
    if (!title.trim() || !logline.trim()) {
      setError(`Give the ${formatDefinition.label} a title and a logline first.`);
      setStep(1);
      return;
    }
    if (castCharacters.length === 0) {
      setError("Lock at least one actor before production.");
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
      setError("Write at least one playable beat with a line of dialogue.");
      setStep(3);
      return;
    }

    const story = addStory({
      title: title.trim(),
      logline: logline.trim(),
      format,
      durationSeconds,
      status: "production",
      creativeDirection: creativeDirection.trim() || undefined,
      authorId: currentUserId,
      coverHue: castCharacters[0]?.avatarHue ?? 205,
      castCharacterIds: castIds,
      scenes: validScenes,
    });
    if (draftId) {
      void fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, { method: "DELETE" });
    }
    router.push(`/productions/${story.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 w-full">
      <Link href="/stories" className="text-xs text-grey hover:text-accent">
        ← Stories
      </Link>

      <div className="mt-3 mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
            AI Writing Room
          </p>
          <h1 className="reel-title text-3xl">From one spark to a shootable script</h1>
        </div>
        <div className="shrink-0 text-right">
          <Link href="/studio" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent hover:text-accent-light">
            Drafts
          </Link>
          <p className={`mt-1 text-[10px] ${
            draftSaveState === "error" ? "text-red-300" :
            draftSaveState === "saved" ? "text-accent-secondary" :
            "text-grey"
          }`}>
            {draftSaveState === "loading" && "Opening draft…"}
            {draftSaveState === "saving" && "Saving…"}
            {draftSaveState === "saved" && "Saved to your account"}
            {draftSaveState === "signed-out" && "Sign in to save drafts"}
            {draftSaveState === "error" && "Draft save needs attention"}
            {draftSaveState === "idle" && "Autosaves when you start"}
          </p>
        </div>
      </div>

      <section className="mb-6" aria-labelledby="output-contract-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              {activeRole === "brand" ? "Brand production" : activeRole === "admin" ? "Super Admin production" : "Creator production"}
            </p>
            <h2 id="output-contract-heading" className="reel-title mt-1 text-2xl">Choose the output before writing</h2>
          </div>
          <Link href="/studio/pipelines" className="text-[10px] text-grey hover:text-accent">See the full map →</Link>
        </div>
        <div className={`grid gap-2 ${formatOptions.length > 1 ? "sm:grid-cols-3" : ""}`}>
          {formatOptions.map((option) => {
            const definition = PRODUCTION_FORMATS[option];
            const selected = format === option;
            const optionDuration = option === "spot" ? durationSeconds : definition.durationSeconds;
            const optionShots = productionShotCount(option, optionDuration);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setFormat(option);
                  setDurationSeconds(productionDuration(option));
                }}
                className={`relative overflow-hidden rounded-lg border p-4 text-left transition-all ${
                  selected
                    ? "border-accent bg-accent/[0.08] shadow-[0_0_30px_rgba(242,78,112,0.08)]"
                    : "border-line bg-white/[0.025] hover:border-white/25"
                }`}
                data-writing-format={option}
                aria-pressed={selected}
              >
                <span className={`font-mono text-3xl ${selected ? "text-accent" : "text-white/35"}`}>{optionDuration}s</span>
                <span className="ml-2 text-sm font-semibold">{definition.label}</span>
                <span className="mt-3 block text-[10px] uppercase tracking-wide text-grey">{optionShots} × five-second shot{optionShots === 1 ? "" : "s"}</span>
                <span className="mt-2 block text-[11px] leading-4 text-grey">{definition.promise}</span>
                <span className={`absolute inset-x-0 bottom-0 h-0.5 ${selected ? "pipeline-flow-line" : "bg-white/5"}`} />
              </button>
            );
          })}
        </div>
        {format === "spot" && (
          <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-line px-4 py-3">
            <div>
              <p className="text-xs font-semibold">Spot runtime</p>
              <p className="mt-0.5 text-[10px] text-grey">Runtime changes the required shot count and delivery contract.</p>
            </div>
            <div className="flex rounded-full border border-line p-1">
              {[30, 60].map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => setDurationSeconds(seconds)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold ${durationSeconds === seconds ? "bg-accent text-white" : "text-grey"}`}
                >
                  {seconds}s · {seconds / 5} shots
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <details className="poster-card mb-6 overflow-hidden rounded-md border border-accent/40 bg-accent/[0.04]" data-magic-writer>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-accent/[0.05]">
          <span>
            <span className="block text-sm font-semibold">✦ Magic assist</span>
            <span className="mt-0.5 block text-[11px] text-grey">Optional: expand one thought into a complete draft.</span>
          </span>
          <span className="shrink-0 rounded-full border border-accent/50 px-3 py-1 text-[10px] font-semibold text-accent">Open</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-4">
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
            <div className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {formatDefinition.label} · {durationSeconds}s · {expectedShotCount} shots
            </div>
          </div>

          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={3}
            placeholder={format === "episode"
              ? "e.g. Lightning Raju loses his powers during the one rescue that matters most..."
              : format === "spot"
                ? "e.g. A launch spot for a fast delivery app, funny but premium..."
                : `e.g. A ${durationSeconds}-second performance that makes this actor impossible to miscast...`}
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

          {/* Cast right here — Magic writes FOR the actors you pick. Empty = Magic picks. */}
          <div data-magic-cast>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-grey">
                Cast {castIds.length > 0 ? `(${castIds.length} picked)` : "(optional — Magic picks if you don't)"}
              </span>
              <button type="button" onClick={() => setStep(2)} className="text-[10px] text-accent hover:underline">
                Full cast search →
              </button>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {world.characters.map((character) => {
                const selected = castIds.includes(character.id);
                const thumb = character.imageUrl ?? character.bannerUrl ?? character.galleryUrls?.[0];
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => toggleCast(character.id)}
                    aria-pressed={selected}
                    className={`relative w-16 shrink-0 overflow-hidden rounded-md border transition-all ${
                      selected ? "border-accent shadow-[0_0_0_1px_var(--accent),0_0_14px_rgba(244,70,112,0.35)]" : "border-line opacity-80 hover:opacity-100"
                    }`}
                  >
                    <span className="block aspect-[3/4] w-full">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- tiny thumb strip, dynamic CDN URLs
                        <img src={thumb} alt={character.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-paper text-lg font-semibold text-grey">
                          {character.name.slice(0, 1)}
                        </span>
                      )}
                    </span>
                    {selected && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-paper">✓</span>
                    )}
                    <span className="block truncate bg-black/60 px-1 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                      {character.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
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
      </details>

      <div className="mb-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-grey">or write it manually</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex gap-2 mb-6 text-xs">
        {(
          [
            [1, "Concept"],
            [2, "Cast"],
            [3, `${formatDefinition.label} script`],
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
              placeholder={format === "episode" ? "e.g. The Last Reel at Midnight" : format === "spot" ? "e.g. One Tap Ahead" : `e.g. ${formatDefinition.label}: First Impression`}
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
              placeholder={format === "episode" ? "One or two sentences that sell the episode" : "The performance promise and dramatic idea in one sentence"}
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
            Next: lock the cast →
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

          {castCharacters.length > 0 && (
            <div className="poster-card rounded-md p-4" data-cast-board>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-grey">
                  The cast, together ({castCharacters.length})
                </p>
                <button onClick={() => setStep(2)} className="text-[11px] text-accent hover:underline">
                  Change cast
                </button>
              </div>
              <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1">
                {castCharacters.map((character) => {
                  const thumb = character.imageUrl ?? character.bannerUrl ?? character.galleryUrls?.[0];
                  return (
                    <Link
                      key={character.id}
                      href={`/characters/${character.id}`}
                      className="group w-24 shrink-0 overflow-hidden rounded-md border border-line transition-colors hover:border-accent sm:w-28"
                    >
                      <span className="block aspect-[3/4] w-full overflow-hidden">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- cast board thumbs, dynamic CDN URLs
                          <img src={thumb} alt={character.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-paper text-2xl font-semibold text-grey">
                            {character.name.slice(0, 1)}
                          </span>
                        )}
                      </span>
                      <span className="block truncate px-1.5 py-1 text-center text-[9px] font-semibold uppercase">
                        {character.name}
                      </span>
                      <span className="-mt-0.5 block truncate px-1.5 pb-1.5 text-center text-[8px] text-grey">
                        {ARCHETYPE_LABEL[character.archetype]}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-grey">
                These locked identities feed every reference frame, voice line, and shot package for this {formatDefinition.label}.
              </p>
            </div>
          )}

          <div className="border-y border-line py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-mono text-2xl text-accent">{durationSeconds}s</p>
                <p className="text-[9px] uppercase tracking-wide text-grey">Final runtime</p>
              </div>
              <div>
                <p className="font-mono text-2xl text-accent-secondary">{expectedShotCount}</p>
                <p className="text-[9px] uppercase tracking-wide text-grey">Required shots</p>
              </div>
              <div>
                <p className="font-mono text-2xl text-ink">{scenes.length}</p>
                <p className="text-[9px] uppercase tracking-wide text-grey">Script beats</p>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-grey">
              This is still a private production draft. Nothing reaches the feed until every shot is generated, reviewed, assembled, and approved.
            </p>
          </div>

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
              onClick={handleStartProduction}
              className="bg-accent text-paper font-semibold px-6 py-2.5 rounded-sm hover:bg-accent-light transition-colors"
            >
              {formatDefinition.finalAction} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
