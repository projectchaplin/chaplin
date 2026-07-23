"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import { getClientAuthIdentity } from "@/lib/client-auth";
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
  durationSeconds?: number;
  previewImageUrl?: string;
  previewAssetId?: string;
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
type MagicRunKind = "concept" | "draft";

const MAGIC_TIMELINES: Record<MagicRunKind, Array<{ label: string; detail: string; startsAt: number }>> = {
  concept: [
    { label: "Read the idea", detail: "Finding the strongest promise in your brief", startsAt: 0 },
    { label: "Study the cast", detail: "Connecting the chosen actor's identity and range", startsAt: 3 },
    { label: "Find the hook", detail: "Building the opening image and dramatic angle", startsAt: 7 },
    { label: "Write the concept", detail: "Shaping title, logline, and creative direction", startsAt: 13 },
    { label: "Continuity check", detail: "Making the concept playable for the selected runtime", startsAt: 21 },
  ],
  draft: [
    { label: "Read the brief", detail: "Locking the idea, runtime, and output format", startsAt: 0 },
    { label: "Connect the cast", detail: "Loading identity, voice, look, and performance rules", startsAt: 3 },
    { label: "Build the hook", detail: "Finding the first visual interruption", startsAt: 8 },
    { label: "Shape scene beats", detail: "Writing objectives, action, pressure, and turns", startsAt: 15 },
    { label: "Check the cut", detail: "Testing duration, continuity, and playable output", startsAt: 27 },
  ],
};

function MagicWritingTimeline({ kind, elapsedSeconds }: { kind: MagicRunKind; elapsedSeconds: number }) {
  const stages = MAGIC_TIMELINES[kind];
  let currentIndex = stages.length - 1;
  for (let index = 0; index < stages.length - 1; index += 1) {
    if (elapsedSeconds < stages[index + 1].startsAt) {
      currentIndex = index;
      break;
    }
  }
  const current = stages[currentIndex];
  const next = stages[currentIndex + 1];
  const phaseProgress = next
    ? Math.min(1, Math.max(0, (elapsedSeconds - current.startsAt) / (next.startsAt - current.startsAt)))
    : Math.min(0.9, (elapsedSeconds - current.startsAt) / 18);
  const progress = Math.min(94, ((currentIndex + phaseProgress) / stages.length) * 100);

  return (
    <div
      className="overflow-hidden rounded-xl border border-accent/45 bg-black/25"
      aria-live="polite"
      aria-label="Chaplin writing progress"
      data-magic-timeline
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{current.label}</p>
            <p className="truncate text-[9px] text-grey">{current.detail}</p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-accent">{elapsedSeconds}s live</span>
      </div>
      <div className="h-1 bg-white/[0.06]">
        <div
          className="pipeline-flow-line h-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>
      <ol className="grid gap-0 px-3 py-3 sm:grid-cols-5">
        {stages.map((stage, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={stage.label} className="relative flex items-center gap-2 py-1.5 sm:block sm:px-1.5 sm:py-0">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[8px] ${
                complete
                  ? "border-accent-secondary bg-accent-secondary/15 text-accent-secondary"
                  : active
                    ? "animate-pulse border-accent bg-accent/15 text-accent"
                    : "border-white/15 text-white/30"
              }`}>
                {complete ? "✓" : index + 1}
              </span>
              <span className={`text-[8px] font-semibold uppercase tracking-[0.08em] sm:mt-1.5 sm:block ${
                complete ? "text-accent-secondary" : active ? "text-ink" : "text-white/30"
              }`}>
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

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
  return { setting: "", objective: "", action: "", durationSeconds: 4, lines: [] };
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
  const [magicRunKind, setMagicRunKind] = useState<MagicRunKind>("draft");
  const [magicElapsedSeconds, setMagicElapsedSeconds] = useState(0);
  const [magicMessage, setMagicMessage] = useState("");
  const [magicWriterOpen, setMagicWriterOpen] = useState(false);
  const [startChoiceOpen, setStartChoiceOpen] = useState(false);
  const [sceneAssistBusy, setSceneAssistBusy] = useState<number | null>(null);
  const [sceneAssistMessage, setSceneAssistMessage] = useState<{ index: number; text: string } | null>(null);
  const [scenePreviewBusy, setScenePreviewBusy] = useState<number | null>(null);
  const [autoPreviewBatch, setAutoPreviewBatch] = useState<{ scenes: DraftScene[]; leadId: string } | null>(null);
  const [claudeConfigured, setClaudeConfigured] = useState<boolean | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draftId, setDraftId] = useState(() => searchParams.get("draft") ?? "");
  const [draftReady, setDraftReady] = useState(() => !searchParams.get("draft"));
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>(
    searchParams.get("draft") ? "loading" : "idle",
  );
  const [draftAccountReady, setDraftAccountReady] = useState(false);
  const [draftAccountId, setDraftAccountId] = useState<string | null>(null);
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
      setStep(1);
      window.setTimeout(() => {
        document.querySelector("[data-concept-magic]")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    let cancelled = false;
    void getClientAuthIdentity()
      .then((identity) => {
        if (cancelled) return;
        setDraftAccountId(identity?.id ?? null);
        setDraftAccountReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDraftAccountId(null);
        setDraftAccountReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const requestedDraftId = searchParams.get("draft");
    if (!requestedDraftId) return;
    if (!draftAccountReady) return;
    if (!draftAccountId) {
      const signedOutTimer = window.setTimeout(() => {
        setDraftReady(true);
        setDraftSaveState("signed-out");
        setError("Sign in to open this private draft.");
      }, 0);
      return () => window.clearTimeout(signedOutTimer);
    }
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
        setScenes(
          Array.isArray(body.scenes) && body.scenes.length
            ? body.scenes.map((scene) => ({ ...scene, durationSeconds: 4 }))
            : [emptyScene()]
        );
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
  }, [draftAccountId, draftAccountReady, searchParams]);

  useEffect(() => {
    if (!draftReady || !draftAccountReady) return;
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
    if (!draftAccountId) {
      const signedOutTimer = window.setTimeout(() => setDraftSaveState("signed-out"), 0);
      return () => window.clearTimeout(signedOutTimer);
    }

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
  }, [brief, castIds, creativeDirection, draftAccountId, draftAccountReady, draftId, draftReady, durationSeconds, format, logline, productImageName, productImageUrl, scenes, step, title]);

  useEffect(() => {
    fetch("/api/write/magic", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setClaudeConfigured(Boolean(data.configured)))
      .catch(() => setClaudeConfigured(false));
  }, []);

  useEffect(() => {
    if (!magicBusy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setMagicElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [magicBusy]);

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
    setScenes((prev) => prev.map((sc, idx) => (
      idx === i ? { ...sc, setting: value, previewImageUrl: undefined, previewAssetId: undefined } : sc
    )));
  }
  function updateScene(i: number, patch: Partial<DraftScene>) {
    const invalidatesPreview = patch.setting !== undefined || patch.objective !== undefined || patch.action !== undefined;
    setScenes((prev) => prev.map((scene, index) => (
      index === i
        ? {
            ...scene,
            ...patch,
            ...(invalidatesPreview ? { previewImageUrl: undefined, previewAssetId: undefined } : {}),
          }
        : scene
    )));
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
    setMagicRunKind(conceptOnly ? "concept" : "draft");
    setMagicElapsedSeconds(0);
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
        const nextCastIds = draft.castIds.filter((id) => world.characters.some((character) => character.id === id));
        setCastIds(nextCastIds);
        const lead = castCharacters[0];
        const nextScenes = (draft.scenes.length ? draft.scenes : [{
          setting: "INT. CHARACTER WORLD - CONTINUOUS",
          objective: `Reveal ${lead?.name ?? "the actor"} through one visible, situation-changing choice.`,
          action: `${lead?.name ?? "The actor"} enters under immediate pressure, finds the detail everyone else missed, and makes one physical choice that changes the scene.`,
          lines: [],
        }]).map((scene) => ({ ...scene, durationSeconds: 4 }));
        setScenes(nextScenes);
        setStep(3);
        const previewLead = world.characters.find((character) => character.id === nextCastIds[0]) ?? lead;
        if (previewLead) setAutoPreviewBatch({ scenes: nextScenes, leadId: previewLead.id });
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

  useEffect(() => {
    if (conciergeRan.current) return;
    if (searchParams.get("auto") !== "1") return;
    if (brief.trim().length < 5 || world.characters.length === 0) return;
    conciergeRan.current = true;
    const timer = window.setTimeout(() => void createMagicDraft(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hand-off once characters exist
  }, [world.characters.length]);

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
      const returnedScenes = Array.isArray(data.draft.scenes) ? data.draft.scenes : [];
      const candidate = returnedScenes[Math.min(sceneIndex, returnedScenes.length - 1)] ?? returnedScenes[0];
      const lead = castCharacters[0];
      const playableScene = candidate ?? {
        setting: currentScene.setting || "INT. CHARACTER WORLD - CONTINUOUS",
        objective: currentScene.objective || `Reveal ${lead?.name ?? "the actor"} through one visible, situation-changing choice.`,
        action: currentScene.action || `${lead?.name ?? "The actor"} enters frame under immediate pressure, notices the one detail everyone else missed, and makes a physical choice that changes the balance of the scene.`,
        lines: currentScene.lines,
      };
      const validCastIds = new Set(castCharacters.map((character) => character.id));
      const shapedScene: DraftScene = {
        setting: playableScene.setting || currentScene.setting,
        objective: playableScene.objective || currentScene.objective,
        action: playableScene.action || currentScene.action,
        durationSeconds: 4,
        lines: playableScene.lines
          .filter((line) => validCastIds.has(line.characterId) && line.text.trim())
          .slice(0, 3),
      };
      updateScene(sceneIndex, shapedScene);
      await generateScenePreview(shapedScene, sceneIndex);
      setSceneAssistMessage({
        index: sceneIndex,
        text: data.warning || (!candidate
          ? `Scene ${sceneIndex + 1} was repaired locally and is ready to edit.`
          : data.provider === "anthropic"
          ? `Scene ${sceneIndex + 1} is shaped and still completely editable.`
          : `Scene ${sceneIndex + 1} was tightened locally and remains editable.`),
      });
    } catch (assistError) {
      setError(assistError instanceof Error ? assistError.message : "Magic Scene failed.");
    } finally {
      setSceneAssistBusy(null);
    }
  }

  async function generateScenePreview(scene: DraftScene, sceneIndex: number, lead = castCharacters[0]) {
    if (!lead) return false;
    setScenePreviewBusy(sceneIndex);
    setError("");
    try {
      const referenceImages = [
        lead.imageUrl ?? lead.galleryUrls?.[0] ?? lead.bannerUrl ?? "",
        productImageUrl,
      ].filter(Boolean);
      const prompt = [
        `PURPOSE: Production thumbnail and binding first frame for scene ${sceneIndex + 1} of "${title || "Untitled production"}".`,
        `FOUR-SECOND BEAT: This image is the exact visual start of one four-second clip in a multi-scene edit.`,
        `SETTING: ${scene.setting || "A specific location grounded in the production concept."}`,
        `SCENE OBJECTIVE: ${scene.objective || "Create one visible situation change."}`,
        `VISIBLE ACTION: ${scene.action || `${lead.name} begins one concise, camera-readable action.`}`,
        `ACTOR: ${lead.name}. Match the supplied identity reference exactly. ${lead.personality}`,
        ...(productImageUrl
          ? [`PRODUCT: The supplied product reference is ${productImageName || "the advertised product"}. Preserve its exact design and make it clearly visible in this scene.`]
          : []),
        "COMPOSITION: cinematic 16:9 frame with a clear foreground, actor, environment, and room for the planned movement. This must look like a scene, not a portrait.",
        "CAMERA: choose one intentional angle and realistic lens that best expresses this beat; face, hands, important props, and environment must be readable.",
        "LIGHT: motivated cinematic light from believable sources in the setting, realistic skin and materials, controlled contrast.",
        "CONTINUITY: preserve the exact actor face, age, hair, body, wardrobe, accessories, palette, and product design across every scene thumbnail.",
        "REALISM: photoreal live-action unless the concept explicitly requests animation, manga, or illustration.",
        "EXCLUSIONS: no replacement actor, identity blend, empty generic background, text overlay, subtitle, UI, border, watermark, or unexplained extra subject.",
      ].join("\n");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "image",
          characterId: lead.id,
          imagePurpose: "scene",
          referenceImages,
          prompt,
        }),
      });
      const data = await response.json() as { url?: string; assetId?: string; error?: string };
      if (!response.ok || !data.url || !data.assetId) {
        throw new Error(data.error || `Scene ${sceneIndex + 1} thumbnail was not created.`);
      }
      updateScene(sceneIndex, {
        durationSeconds: 4,
        previewImageUrl: data.url,
        previewAssetId: data.assetId,
      });
      return true;
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : `Scene ${sceneIndex + 1} thumbnail failed.`);
      return false;
    } finally {
      setScenePreviewBusy(null);
    }
  }

  async function generateAllScenePreviews(nextScenes = scenes, lead = castCharacters[0]) {
    if (!lead) return;
    for (let index = 0; index < nextScenes.length; index += 1) {
      await generateScenePreview(nextScenes[index], index, lead);
    }
  }

  useEffect(() => {
    if (!autoPreviewBatch) return;
    const lead = world.characters.find((character) => character.id === autoPreviewBatch.leadId);
    if (lead) {
      void generateAllScenePreviews(autoPreviewBatch.scenes, lead)
        .finally(() => setAutoPreviewBatch(null));
    } else {
      window.setTimeout(() => setAutoPreviewBatch(null), 0);
    }
    // This is a one-shot handoff after Magic Writer replaces the complete scene array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPreviewBatch]);

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
        durationSeconds: 4,
        previewImageUrl: sc.previewImageUrl,
        previewAssetId: sc.previewAssetId,
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
                <span className="mt-3 block text-[10px] uppercase tracking-wide text-grey">
                  {option === "spark" ? "1 × five-second audition" : `${optionShots} × four-second scene${optionShots === 1 ? "" : "s"}`}
                </span>
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
        className="hidden"
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
            <button
              type="button"
              onClick={() => void generateAllScenePreviews()}
              disabled={scenePreviewBusy !== null || castCharacters.length === 0 || !scenes.some((scene) => scene.setting || scene.action)}
              className="shrink-0 rounded-full border border-accent-secondary/55 px-4 py-2 text-xs font-semibold text-accent-secondary hover:bg-accent-secondary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {scenePreviewBusy !== null ? `Framing scene ${scenePreviewBusy + 1}…` : "Generate all thumbnails"}
            </button>
          </div>
          {magicBusy && magicRunKind === "draft" && (
            <MagicWritingTimeline kind="draft" elapsedSeconds={magicElapsedSeconds} />
          )}
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
                <p className="text-sm font-semibold text-ink">✦ Magic</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-grey">
                  Give Chaplin one thought. It fills the concept, chooses cast when needed, and writes the complete editable scene plan.
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
              onClick={() => createMagicDraft()}
              disabled={magicBusy || world.characters.length === 0}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-accent px-4 py-2.5 text-left text-sm font-semibold text-paper shadow-[0_10px_26px_rgba(242,78,112,0.18)] hover:bg-accent-light disabled:opacity-50"
              data-action="magic-script"
            >
              <span>{magicBusy ? "Writing everything..." : "✦ Magic: write everything"}</span>
              <span className="text-[10px] font-medium opacity-70">{formatDefinition.label} · {durationSeconds}s</span>
            </button>
            {magicBusy && magicRunKind === "draft" && (
              <div className="mt-3">
                <MagicWritingTimeline kind="draft" elapsedSeconds={magicElapsedSeconds} />
              </div>
            )}
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
          {magicBusy && magicRunKind === "draft" && (
            <MagicWritingTimeline kind="draft" elapsedSeconds={magicElapsedSeconds} />
          )}

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

              <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <div className="relative aspect-video overflow-hidden bg-black">
                  {scene.previewImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- generated scene frames use dynamic provider URLs
                    <img
                      src={scene.previewImageUrl}
                      alt={`Scene ${si + 1} starting frame`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="relative flex h-full items-center justify-center">
                      {castCharacters[0] && (castCharacters[0].imageUrl ?? castCharacters[0].bannerUrl ?? castCharacters[0].galleryUrls?.[0]) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- dynamic actor seed URL
                        <img
                          src={castCharacters[0].imageUrl ?? castCharacters[0].bannerUrl ?? castCharacters[0].galleryUrls?.[0]}
                          alt=""
                          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-[2px]"
                        />
                      ) : null}
                      <div className="relative z-10 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-grey">No starting frame yet</p>
                        <p className="mt-1 text-xs text-white/60">Generate the visual before animation.</p>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-accent-secondary">Scene {String(si + 1).padStart(2, "0")}</p>
                      <p className="mt-0.5 text-xs font-semibold text-white">{scene.setting || "Untitled scene"}</p>
                    </div>
                    <span className="rounded-full border border-white/25 bg-black/55 px-2.5 py-1 font-mono text-[9px] text-white backdrop-blur">
                      4 SEC
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5">
                  <p className="text-[9px] text-grey">
                    {scene.previewImageUrl ? "This frame becomes the video’s visual starting point." : "Actor, setting, action, light, and product will be composed here."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void generateScenePreview(scene, si)}
                    disabled={scenePreviewBusy !== null || castCharacters.length === 0}
                    className="shrink-0 rounded-full border border-accent/55 px-3 py-1.5 text-[9px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
                  >
                    {scenePreviewBusy === si ? "Generating…" : scene.previewImageUrl ? "Regenerate frame" : "Generate frame"}
                  </button>
                </div>
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
