"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    productImageUrl?: string;
    productImageName?: string;
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

function emptyScene(): DraftScene {
  return { setting: "", objective: "", action: "", lines: [] };
}

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
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productImageName, setProductImageName] = useState("");
  const [productUploadBusy, setProductUploadBusy] = useState(false);
  const [castQuery, setCastQuery] = useState("");
  const [castIds, setCastIds] = useState<string[]>(() => {
    const preset = searchParams.getAll("cast");
    return preset.filter((id) => world.characters.some((c) => c.id === id));
  });
  const [scenes, setScenes] = useState<DraftScene[]>([emptyScene()]);
  const [error, setError] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicMessage, setMagicMessage] = useState("");
  const [magicWriterOpen, setMagicWriterOpen] = useState(false);
  const [startChoiceOpen, setStartChoiceOpen] = useState(false);
  const [sceneAssistBusy, setSceneAssistBusy] = useState<number | null>(null);
  const [sceneAssistMessage, setSceneAssistMessage] = useState<{ index: number; text: string } | null>(null);
  const [claudeConfigured, setClaudeConfigured] = useState<boolean | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draftId, setDraftId] = useState(() => searchParams.get("draft") ?? "");
  const [draftReady, setDraftReady] = useState(() => !searchParams.get("draft"));
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>(
    searchParams.get("draft") ? "loading" : "idle",
  );
  const pendingSceneFocusRef = useRef<number | null>(null);
  const formatOptions = formatsForRole(activeRole);
  const formatDefinition = PRODUCTION_FORMATS[format];
  const expectedShotCount = productionShotCount(format, durationSeconds);

  useEffect(() => {
    if (!startChoiceOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStartChoiceOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [startChoiceOpen]);

  function chooseSparkStart(path: "magic" | "manual") {
    setStartChoiceOpen(false);
    if (path === "magic") {
      setMagicWriterOpen(true);
      window.setTimeout(() => {
        document.querySelector("[data-magic-writer]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
      return;
    }
    setStep(1);
    window.setTimeout(() => {
      document.querySelector("[data-manual-writer]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

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
        setDurationSeconds(productionDuration(stored.format, body.durationSeconds));
        setCreativeDirection(body.creativeDirection ?? "");
        setProductImageUrl(body.productImageUrl ?? "");
        setProductImageName(body.productImageName ?? "");
        setCastIds(Array.isArray(body.castIds) ? body.castIds : []);
        setScenes(Array.isArray(body.scenes) && body.scenes.length ? body.scenes : [emptyScene()]);
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
      productImageUrl ||
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
          body: {
            brief,
            durationSeconds,
            creativeDirection,
            castIds,
            scenes,
            step,
            productImageUrl,
            productImageName,
          },
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
  }, [brief, castIds, creativeDirection, draftId, draftReady, durationSeconds, format, logline, productImageName, productImageUrl, scenes, step, title]);

  useEffect(() => {
    fetch("/api/write/magic", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setClaudeConfigured(Boolean(data.configured)))
      .catch(() => setClaudeConfigured(false));
  }, []);

  useEffect(() => {
    const sceneIndex = pendingSceneFocusRef.current;
    if (sceneIndex === null) return;
    pendingSceneFocusRef.current = null;
    const sceneCard = document.querySelector<HTMLElement>(`[data-scene-card="${sceneIndex}"]`);
    const settingInput = document.querySelector<HTMLInputElement>(`[data-scene-setting="${sceneIndex}"]`);
    sceneCard?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => settingInput?.focus(), 320);
  }, [scenes.length]);

  useEffect(() => {
    const applyVoiceDirection = (event: Event) => {
      const direction = (event as CustomEvent<{ brief?: string | null }>).detail?.brief?.trim();
      if (!direction) return;
      setBrief((current) => {
        if (!current.trim()) return direction;
        if (current.toLowerCase().includes(direction.toLowerCase())) return current;
        return `${current.trim()}\n${direction}`;
      });
      setMagicMessage("Voice direction added to this production.");
    };
    window.addEventListener("chaplin:story-assist", applyVoiceDirection);
    return () => window.removeEventListener("chaplin:story-assist", applyVoiceDirection);
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

  async function uploadProductImage(file: File) {
    setProductUploadBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/products/reference", { method: "POST", body: form });
      const data = await response.json() as { url?: string; name?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Product image could not be uploaded.");
      setProductImageUrl(data.url);
      setProductImageName(data.name || file.name);
      setMagicMessage("Product reference locked. Chaplin will preserve this exact product in the ad.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Product image could not be uploaded.");
    } finally {
      setProductUploadBusy(false);
    }
  }

  function addScene() {
    setScenes((prev) => {
      pendingSceneFocusRef.current = prev.length;
      return [...prev, emptyScene()];
    });
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

  async function createMagicDraft({ conceptOnly = false }: { conceptOnly?: boolean } = {}) {
    if (format === "spot" && !productImageUrl) {
      setError("Upload the product image first. It is the visual source of truth for this ad.");
      setStep(1);
      document.querySelector("[data-product-reference]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
          productImageUrl,
          productImageName,
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
      if (!conceptOnly) {
        setCastIds(draft.castIds.filter((id) => world.characters.some((character) => character.id === id)));
        setScenes(draft.scenes.length ? draft.scenes : [emptyScene()]);
        setStep(3);
      }
      setClaudeConfigured(Boolean(data.configured));
      setMagicMessage(
        data.warning || (conceptOnly
          ? data.provider === "anthropic"
            ? "Concept ready. Claude filled the title, logline, and creative direction; everything remains editable."
            : "Concept ready. The three fields are filled and still completely editable."
          : data.provider === "anthropic"
            ? "Claude expanded your input into a complete, editable production draft."
            : "A complete local draft is ready. Add your Claude key for deeper character-aware variations.")
      );
    } catch (magicError) {
      setError(magicError instanceof Error ? magicError.message : "Magic Writer failed.");
    } finally {
      setMagicBusy(false);
    }
  }

  function continueToScenes() {
    setStep(3);
    const hasScenePlan = scenes.some((scene) =>
      Boolean(scene.setting.trim() || scene.objective.trim() || scene.action.trim() || scene.lines.some((line) => line.text.trim()))
    );
    if (!hasScenePlan && castCharacters.length > 0) {
      void createMagicDraft();
    }
  }

  async function assistScene(sceneIndex: number) {
    const currentScene = scenes[sceneIndex];
    if (!currentScene) return;
    setSceneAssistBusy(sceneIndex);
    setSceneAssistMessage(null);
    setError("");
    try {
      const sceneBrief = [
        brief,
        title ? `Production title: ${title}.` : "",
        logline ? `Overall logline: ${logline}.` : "",
        creativeDirection ? `Creative direction: ${creativeDirection}.` : "",
        `Focus on scene ${sceneIndex + 1} only. Preserve the user's intent and turn it into one camera-playable beat. Dialogue is optional; use it only if spoken words genuinely improve the beat.`,
        currentScene.setting ? `Current setting: ${currentScene.setting}.` : "",
        currentScene.objective ? `Current objective: ${currentScene.objective}.` : "",
        currentScene.action ? `Current visible action: ${currentScene.action}.` : "",
        currentScene.lines.length
          ? `Current dialogue: ${currentScene.lines.map((line) => line.text).filter(Boolean).join(" / ")}.`
          : "The user has not requested dialogue.",
      ].filter(Boolean).join(" ");

      const response = await fetch("/api/write/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          durationSeconds,
          brief: sceneBrief,
          title,
          logline,
          productImageUrl,
          productImageName,
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
        warning?: string;
      };
      if (!response.ok || !data.draft) throw new Error(data.error || "Magic Scene could not shape this beat.");
      const candidate = data.draft.scenes[Math.min(sceneIndex, data.draft.scenes.length - 1)] ?? data.draft.scenes[0];
      if (!candidate) throw new Error("Magic Scene returned no playable beat.");
      const validCastIds = new Set(castCharacters.map((character) => character.id));
      updateScene(sceneIndex, {
        setting: candidate.setting || currentScene.setting,
        objective: candidate.objective || currentScene.objective,
        action: candidate.action || currentScene.action,
        lines: candidate.lines
          .filter((line) => validCastIds.has(line.characterId) && line.text.trim())
          .slice(0, 3),
      });
      setSceneAssistMessage({
        index: sceneIndex,
        text: data.warning || (data.provider === "anthropic"
          ? `Scene ${sceneIndex + 1} is shaped and still completely editable.`
          : `Scene ${sceneIndex + 1} was tightened locally and remains editable.`),
      });
    } catch (assistError) {
      setError(assistError instanceof Error ? assistError.message : "Magic Scene failed.");
    } finally {
      setSceneAssistBusy(null);
    }
  }

  async function handleStartProduction() {
    if (format === "spot" && !productImageUrl) {
      setError("Upload the product image before starting an ad production.");
      setStep(1);
      document.querySelector("[data-product-reference]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
      .filter((sc) => Boolean(sc.objective || sc.action || sc.lines.length > 0));

    if (validScenes.length === 0) {
      setError("Add a scene objective, visible action, or a line of dialogue.");
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
      productImageUrl: productImageUrl || undefined,
      productImageName: productImageName || undefined,
      authorId: currentUserId,
      coverHue: castCharacters[0]?.avatarHue ?? 205,
      castCharacterIds: castIds,
      scenes: validScenes,
    });
    if (draftId) {
      void fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, { method: "DELETE" });
    }
    await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: [
          `Script locked: ${story.title}`,
          `${validScenes.length} playable scene${validScenes.length === 1 ? "" : "s"} · ${durationSeconds}s ${formatDefinition.label}`,
          `Cast: ${castCharacters.map((character) => character.name).join(", ")}`,
          story.logline,
        ].join("\n"),
      }),
    }).catch(() => undefined);
    router.push(`/productions/${story.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 w-full">
      {startChoiceOpen && createPortal(
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/72 p-0 backdrop-blur-xl sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close Spark start options"
            onClick={() => setStartChoiceOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="spark-start-title"
            className="spark-start-dialog relative z-10 w-full max-w-xl rounded-t-[28px] border border-white/15 p-4 shadow-2xl sm:rounded-[28px] sm:p-5"
            data-spark-start-dialog
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-accent">5s Spark</p>
                <h2 id="spark-start-title" className="reel-title mt-1 text-2xl sm:text-3xl">Okay, what do you want to do?</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/48">Choose how much of the first draft Chaplin should shape.</p>
              </div>
              <button
                type="button"
                onClick={() => setStartChoiceOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-lg text-white/55 hover:border-accent hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => chooseSparkStart("magic")}
                className="group rounded-[20px] border border-accent/55 bg-accent/[0.09] p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/[0.14]"
                data-spark-path="magic"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg text-white shadow-[0_0_24px_rgba(242,78,112,0.28)]">✦</span>
                <span className="mt-4 block text-base font-semibold">Use Magic Assist</span>
                <span className="mt-1.5 block text-[11px] leading-5 text-white/58">
                  Give Chaplin one thought. It writes the complete editable Spark: concept, cast, action, and optional dialogue.
                </span>
                <span className="mt-4 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">
                  Complete first draft <span aria-hidden="true">→</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => chooseSparkStart("manual")}
                className="group rounded-[20px] border border-white/14 bg-white/[0.035] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-secondary/55 hover:bg-white/[0.055]"
                data-spark-path="manual"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent-secondary/45 bg-accent-secondary/10 text-sm font-bold text-accent-secondary">Aa</span>
                <span className="mt-4 block text-base font-semibold">Write your own</span>
                <span className="mt-1.5 block text-[11px] leading-5 text-white/58">
                  You lead Concept, Cast, and Script. Smaller assists can shape a field or scene without taking over the complete draft.
                </span>
                <span className="mt-4 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-accent-secondary">
                  Guided manual flow <span aria-hidden="true">→</span>
                </span>
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href="/stories" className="text-xs text-grey hover:text-accent">
          ← Stories
        </Link>
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <Link href="/studio" className="shrink-0 text-[10px] font-semibold text-accent hover:text-accent-light">
            Drafts
          </Link>
          <span className="text-white/20" aria-hidden="true">·</span>
          <span className={`truncate text-[10px] ${
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
          </span>
        </div>
      </div>

      <h1 className="reel-title mb-5 text-2xl sm:text-3xl">Create a shootable story</h1>

      {format === "spot" && (
        <section
          className="mb-6 overflow-hidden rounded-2xl border border-accent/55 bg-[linear-gradient(135deg,rgba(244,63,105,0.12),rgba(255,255,255,0.025))]"
          data-product-reference
          aria-labelledby="product-reference-heading"
        >
          <div className="border-b border-white/10 p-4 sm:p-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-accent">First question</p>
            <h2 id="product-reference-heading" className="reel-title mt-1 text-2xl">Show us the product</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-grey">
              Upload the exact product image first. It becomes the product identity reference for the concept, frames, and final ad.
            </p>
          </div>
          <div className="p-4 sm:p-5">
            {productImageUrl ? (
              <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Supabase URL */}
                <img
                  src={productImageUrl}
                  alt={productImageName || "Product reference"}
                  className="aspect-square w-full rounded-xl border border-white/10 bg-white object-contain"
                />
                <div>
                  <p className="text-sm font-semibold">Product reference locked</p>
                  <p className="mt-1 truncate text-[10px] text-grey">{productImageName || "Uploaded product image"}</p>
                  <label className="mt-3 inline-flex cursor-pointer rounded-full border border-accent/60 px-4 py-2 text-[10px] font-semibold text-accent hover:bg-accent/10">
                    Replace image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadProductImage(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-accent/55 bg-black/15 px-5 py-8 text-center hover:bg-accent/[0.05]">
                <span className="text-3xl text-accent">+</span>
                <span className="mt-2 text-sm font-semibold">{productUploadBusy ? "Uploading product…" : "Upload product image"}</span>
                <span className="mt-1 text-[10px] text-grey">PNG, JPEG, or WebP · up to 12 MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={productUploadBusy}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadProductImage(file);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </section>
      )}

      <section className="mb-6" aria-labelledby="output-contract-heading">
        <div className="mb-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 id="output-contract-heading" className="text-sm font-semibold">Choose output</h2>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-semibold text-grey">
              {activeRole === "brand" ? "Brand" : activeRole === "admin" ? "Admin" : "Creator"}
            </span>
          </div>
          <Link href="/studio/pipelines" className="text-[10px] text-grey hover:text-accent">Pipeline map →</Link>
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
                  if (option === "spark") setStartChoiceOpen(true);
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

      <details
        open={magicWriterOpen}
        onToggle={(event) => setMagicWriterOpen(event.currentTarget.open)}
        className="poster-card mb-6 scroll-mt-24 overflow-hidden rounded-md border border-accent/40 bg-accent/[0.04]"
        data-magic-writer
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-accent/[0.05]">
          <span>
            <span className="block text-sm font-semibold">✦ Magic assist</span>
            <span className="mt-0.5 block text-[11px] text-grey">Optional: expand one thought into a complete draft.</span>
          </span>
          <span className="shrink-0 rounded-full border border-accent/50 px-3 py-1 text-[10px] font-semibold text-accent">Open</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-xl text-xs leading-relaxed text-grey">
              Give Chaplin one thought. It expands into cast, structure, visible action, and optional dialogue.
            </p>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] ${
                claudeConfigured ? "border-emerald-500/50 text-emerald-500" : "border-line text-grey"
              }`}>
                {claudeConfigured === null ? "Checking AI" : claudeConfigured ? "Claude connected" : "Local mode"}
              </span>
            <div className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {formatDefinition.label} · {durationSeconds}s · {expectedShotCount} shots
            </div>
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
              onClick={() => createMagicDraft()}
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

      <div className="mb-4 h-px scroll-mt-24 bg-line" aria-hidden="true" data-manual-writer />

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
          <div className="concept-magic rounded-xl border border-accent/45 p-3.5 sm:p-4" data-concept-magic>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">✦ Concept Magic</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-grey">
                  Chaplin fills only the title, logline, and creative direction. Review everything before Cast.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-accent-secondary/35 bg-accent-secondary/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-accent-secondary">
                Editable
              </span>
            </div>

            <textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={2}
              placeholder={`e.g. A ${durationSeconds}-second ${formatDefinition.label.toLowerCase()} where one small choice reveals who the actor really is…`}
              className="mt-3 w-full resize-none rounded-lg border border-white/12 bg-black/20 px-3 py-2.5 text-xs text-ink placeholder:text-white/30 focus:border-accent focus:outline-none"
              data-concept-magic-brief
            />

            <div className="mt-2 no-scrollbar flex gap-1.5 overflow-x-auto pb-1" aria-label="Concept idea starters">
              {IDEA_STARTERS[format].slice(0, 3).map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setBrief((current) => current ? `${current} ${idea}.` : idea)}
                  className="shrink-0 rounded-full border border-white/12 bg-white/[0.035] px-2.5 py-1.5 text-[9px] text-white/55 hover:border-accent hover:text-white"
                >
                  + {idea}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => createMagicDraft({ conceptOnly: true })}
              disabled={magicBusy}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-accent px-4 py-2.5 text-left text-sm font-semibold text-paper shadow-[0_10px_26px_rgba(242,78,112,0.18)] hover:bg-accent-light disabled:opacity-50"
              data-action="magic-concept"
            >
              <span>{magicBusy ? "Shaping the concept…" : "✦ Fill the concept"}</span>
              <span className="text-[10px] font-medium opacity-70">{formatDefinition.label} · {durationSeconds}s</span>
            </button>
            {magicMessage && <p className="mt-2 text-[10px] leading-relaxed text-accent-secondary">{magicMessage}</p>}
          </div>

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
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-grey hover:text-accent px-4 py-2"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={continueToScenes}
              disabled={magicBusy || castCharacters.length === 0}
              className="bg-accent text-paper font-semibold px-4 py-2 rounded-sm hover:bg-accent-light transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            >
              {magicBusy ? "Building scenes…" : "Next: generate scenes →"}
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
              Locking the script shares a production update with the creator feed. Every generated still, video, dialogue, effect, and theme joins the feed automatically.
            </p>
          </div>

          <div className="poster-card flex flex-col gap-3 rounded-md border-accent/35 bg-accent/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                {magicBusy ? "Chaplin is building the scene beats…" : "Build the scenes from this concept"}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-grey">
                Generate the complete editable scene plan from the concept, cast, and locked product reference.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void createMagicDraft()}
              disabled={magicBusy || castCharacters.length === 0}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-45"
              data-action="generate-scenes"
            >
              {magicBusy ? "Building scenes…" : scenes.some((scene) => scene.setting || scene.objective || scene.action) ? "Regenerate all scenes" : "✦ Generate scenes"}
            </button>
          </div>

          {scenes.map((scene, si) => (
            <div key={si} className="poster-card scroll-mt-24 rounded-md p-5" data-scene-card={si}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="accent-rule w-6" />
                <input
                  value={scene.setting}
                  onChange={(e) => updateSceneSetting(si, e.target.value)}
                  placeholder={`Scene ${si + 1} setting: e.g. A rain-slicked rooftop`}
                  className="min-w-[12rem] flex-1 border-b border-line bg-transparent px-1 py-1 text-xs uppercase tracking-wide focus:border-accent focus:outline-none"
                  data-scene-setting={si}
                />
                <button
                  type="button"
                  onClick={() => assistScene(si)}
                  disabled={sceneAssistBusy !== null || castCharacters.length === 0}
                  className="shrink-0 rounded-full border border-accent/55 bg-accent/10 px-3 py-1.5 text-[10px] font-semibold text-accent hover:bg-accent/15 disabled:opacity-40"
                  data-action="magic-scene"
                  data-scene-index={si}
                >
                  {sceneAssistBusy === si ? "Shaping…" : "✦ Magic scene"}
                </button>
                {scenes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeScene(si)}
                    className="text-xs text-grey hover:text-red-600"
                  >
                    Remove scene
                  </button>
                )}
              </div>
              {sceneAssistMessage?.index === si && sceneAssistBusy === null && (
                <p className="mb-3 rounded-lg border border-accent-secondary/25 bg-accent-secondary/[0.06] px-3 py-2 text-[10px] text-accent-secondary">
                  {sceneAssistMessage.text}
                </p>
              )}

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
                      type="button"
                      onClick={() => removeLine(si, li)}
                      className="self-end text-grey hover:text-red-600 px-2 py-2 sm:self-auto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => addLine(si)}
                    disabled={castCharacters.length === 0}
                    className="self-start text-xs text-accent hover:underline disabled:text-grey disabled:no-underline"
                  >
                    + Add a line
                  </button>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-grey">
                    Dialogue optional
                  </span>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
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
