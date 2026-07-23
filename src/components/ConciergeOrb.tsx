"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { IconBriefcase, IconFilm, IconMicrophone, IconReceipt } from "@/components/Icons";
import { getClientAuthIdentity } from "@/lib/client-auth";
import type { MediaPipelineRun } from "@/lib/media-pipeline-types";
import { useChaplinStore } from "@/lib/store";

export type ConciergeQuickOption = {
  kind: "actor" | "video" | "ad" | "reel" | "micro-drama" | "pipeline" | "operations";
  href: string;
  title: string;
  copy: string;
};

export type ConciergeOrbState = "idle" | "listening" | "thinking" | "speaking";
export type ConciergeOrbHandle = {
  startPushToTalk(): void;
  stopPushToTalk(): void;
};

type MissionStep = { label: string; ms: number };
type DraftSummary = {
  id: string;
  format: "spark" | "punch" | "episode" | "spot";
  title: string;
  logline: string;
  updated_at: string;
};

type ConciergeIntentResponse = {
  intent: "answer" | "create_character" | "create_spark" | "create_punch" | "create_episode" | "create_spot" | "create_series" | "browse" | "unclear";
  name: string | null;
  archetypes: string[];
  characterBrief: string | null;
  storyBrief: string | null;
  reply: string;
  error?: string;
};

async function readIntentResponse(response: Response): Promise<ConciergeIntentResponse> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    // Consume the body without ever exposing a Next.js HTML error document in
    // the product UI. A rebuild can briefly make an App Router endpoint return
    // its HTML fallback even though the next request succeeds.
    await response.text().catch(() => "");
    throw new Error(
      response.status === 404
        ? "Create is reconnecting. Refresh once, then try again."
        : "Create was briefly unavailable. Please try again.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Create received an incomplete response. Please try again.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Create received an incomplete response. Please try again.");
  }

  const data = payload as Partial<ConciergeIntentResponse>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Create could not finish that. Please try again.");
  }
  if (
    typeof data.intent !== "string" ||
    typeof data.reply !== "string" ||
    !Array.isArray(data.archetypes)
  ) {
    throw new Error("Create received an incomplete response. Please try again.");
  }

  return data as ConciergeIntentResponse;
}

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  readonly error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function QuickOptionVisual({ kind }: Pick<ConciergeQuickOption, "kind">) {
  if (kind === "video") {
    return (
      <span className="relative block h-24 overflow-hidden rounded-xl border border-white/12 sm:h-28 sm:rounded-[1rem]">
        <video
          src="/characters/c-selene-video.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/5" />
        <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-lg sm:bottom-2.5 sm:left-2.5 sm:h-8 sm:w-8">
          <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-black" />
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm sm:right-3 sm:top-3 sm:text-[8px]">
          5s · 15s · 60s
        </span>
      </span>
    );
  }

  if (kind === "actor") {
    return (
      <span className="relative block h-24 overflow-hidden rounded-xl border border-white/12 sm:h-28 sm:rounded-[1rem]">
        <Image
          src="/characters/c-rustam-banner.webp"
          alt=""
          fill
          sizes="(max-width: 640px) 44vw, 240px"
          className="object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />
        <span className="absolute bottom-2 left-2 rounded-full border border-white/20 bg-black/45 px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:text-[8px]">
          Face · Voice · World
        </span>
      </span>
    );
  }

  const Icon = kind === "pipeline"
    ? IconFilm
    : kind === "operations"
      ? IconReceipt
      : kind === "ad"
        ? IconBriefcase
        : IconFilm;
  const label = kind === "micro-drama" ? "60 sec" : kind === "reel" ? "Vertical" : kind === "ad" ? "30 / 60 sec" : "Open";

  return (
    <span className="flex h-20 items-center justify-between rounded-[1rem] border border-white/12 px-4">
      <Icon className="h-8 w-8 text-accent" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</span>
    </span>
  );
}

function VoiceStatus({ state }: { state: ConciergeOrbState }) {
  return (
    <div
      className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
        state === "listening"
          ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-400"
          : state === "thinking"
            ? "border-accent/45 bg-accent/10 text-accent"
            : state === "speaking"
              ? "border-accent-secondary/45 bg-accent-secondary/10 text-accent-secondary"
              : "border-white/10 text-white/40"
      }`}
      data-voice-status={state}
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {state === "listening" && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />}
        <span
          className={`relative h-2 w-2 rounded-full ${
            state === "listening"
              ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
              : state === "thinking"
                ? "animate-pulse bg-accent"
                : state === "speaking"
                  ? "animate-pulse bg-accent-secondary"
                  : "bg-white/25"
          }`}
        />
      </span>
      <span>
        {state === "listening"
          ? "Live · Listening"
          : state === "thinking"
            ? "Working"
            : state === "speaking"
              ? "Chaplin speaking"
              : "Voice ready · Standby"}
      </span>
    </div>
  );
}

const ALLOWED_ARCHETYPES = [
  "villain",
  "mentor",
  "love-interest",
  "comic-relief",
  "hero",
  "superhero",
  "horror",
  "rebel",
  "sidekick",
  "outsider",
];

function asksForOwnedCharacters(value: string) {
  const text = value.toLowerCase().replace(/[^\w\s-]/g, " ");
  const mentionsCharacters = /\b(characters?|actors?|personas?)\b/.test(text);
  const asksToInspect = /\b(what all|which|how many|list|show|check|see|find|have|created|made|built)\b/.test(text);
  const refersToSelf = /\b(my|mine|i have|i created|i made|i built|account|shelf)\b/.test(text);
  return mentionsCharacters && asksToInspect && refersToSelf;
}

function asksForOwnedProductions(value: string) {
  const text = value.toLowerCase().replace(/[^\w\s-]/g, " ");
  return /\b(productions?|pipelines?|projects?|drafts?|stories|sparks?|punches|episodes?|spots?)\b/.test(text)
    && /\b(my|mine|i have|i created|i made|account|in production|working on|status)\b/.test(text);
}

const ConciergeOrb = forwardRef<ConciergeOrbHandle, {
  role: string;
  quickOptions: ConciergeQuickOption[];
  assistantOnly?: boolean;
  onClose: () => void;
  onStateChange?: (state: ConciergeOrbState) => void;
}>(function ConciergeOrb({
  role,
  quickOptions,
  assistantOnly = false,
  onClose,
  onStateChange,
}, ref) {
  const router = useRouter();
  const pathname = usePathname();
  const characters = useChaplinStore((state) => state.characters);
  const users = useChaplinStore((state) => state.users);
  const stories = useChaplinStore((state) => state.stories);
  const castings = useChaplinStore((state) => state.castings);
  const currentUserId = useChaplinStore((state) => state.currentUserId);
  const ownedCharacters = useMemo(
    () => characters.filter((character) => character.makerId === currentUserId),
    [characters, currentUserId],
  );
  const ownedStories = useMemo(
    () => stories.filter((story) => story.authorId === currentUserId),
    [currentUserId, stories],
  );
  const currentUser = users.find((user) => user.id === currentUserId);
  const [orbState, setOrbState] = useState<ConciergeOrbState>("idle");
  const [agentLine, setAgentLine] = useState("");
  const [userLine, setUserLine] = useState("");
  const [characterResultIds, setCharacterResultIds] = useState<string[]>([]);
  const [productionResultIds, setProductionResultIds] = useState<string[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<MediaPipelineRun[]>([]);
  const [pipelineContextReady, setPipelineContextReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [savedDrafts, setSavedDrafts] = useState<DraftSummary[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechUrlRef = useRef("");
  const speechRequestRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef("");
  const recognitionFailedRef = useRef(false);
  const closedRef = useRef(false);
  const sessionIdRef = useRef("");
  const stepClockRef = useRef(0);
  const stepsRef = useRef<MissionStep[]>([]);
  const creatorContext = useMemo(() => {
    const ownedStoryIds = new Set(ownedStories.map((story) => story.id));
    const runByProductionId = new Map<string, MediaPipelineRun>();
    for (const run of pipelineRuns) {
      const productionId = typeof run.spec.productionId === "string" ? run.spec.productionId : "";
      if (productionId && ownedStoryIds.has(productionId)) runByProductionId.set(productionId, run);
    }

    return {
      creator: {
        id: currentUserId,
        name: currentUser?.name ?? "Creator",
        role,
      },
      contextReady: pipelineContextReady,
      characters: ownedCharacters.slice(0, 30).map((character) => ({
        id: character.id,
        name: character.name,
        archetype: character.archetype,
        archetypeMix: character.archetypeMix ?? [character.archetype],
        tagline: character.tagline,
        personality: character.personality.slice(0, 500),
        voice: `${character.voiceGender}: ${character.voiceDesc}`.slice(0, 350),
        signatureSfx: character.sfxDesc.slice(0, 250),
        theme: character.themeDesc.slice(0, 250),
        media: {
          image: Boolean(character.imageUrl),
          banner: Boolean(character.bannerUrl),
          video: Boolean(character.videoUrl),
          voiceLocked: Boolean(character.voiceId),
          galleryImages: character.galleryUrls?.length ?? 0,
        },
        stats: character.stats,
      })),
      productions: ownedStories.slice(0, 30).map((story) => {
        const castNames = castings
          .filter((casting) => casting.storyId === story.id)
          .map((casting) => characters.find((character) => character.id === casting.characterId)?.name)
          .filter((name): name is string => Boolean(name));
        const run = runByProductionId.get(story.id);
        return {
          id: story.id,
          title: story.title,
          format: story.format ?? "story",
          durationSeconds: story.durationSeconds ?? null,
          status: story.status ?? "published",
          logline: story.logline,
          cast: castNames,
          scenes: story.scenes.length,
          pipeline: run ? {
            id: run.id,
            status: run.status,
            currentStep: run.currentStep,
            output: run.outputLabel,
            steps: run.steps.map((step) => ({ label: step.label, status: step.status })),
          } : null,
        };
      }),
      drafts: savedDrafts.map((draft) => ({
        id: draft.id,
        title: draft.title,
        format: draft.format,
        logline: draft.logline,
        updatedAt: draft.updated_at,
      })),
    };
  }, [
    castings,
    characters,
    currentUser?.name,
    currentUserId,
    ownedCharacters,
    ownedStories,
    pipelineContextReady,
    pipelineRuns,
    role,
    savedDrafts,
  ]);
  const mark = useCallback((label: string) => {
    const now = performance.now();
    const ms = stepClockRef.current ? now - stepClockRef.current : 0;
    stepClockRef.current = now;
    stepsRef.current = [...stepsRef.current, { label, ms }];
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requests = [
      ...ownedCharacters.map((character) => ({ scopeType: "actor", scopeId: character.id })),
      ...ownedStories.map((story) => ({
        scopeType: story.format === "spot" ? "spot" : "episode",
        scopeId: story.id,
      })),
    ];
    const uniqueRequests = Array.from(
      new Map(requests.map((request) => [`${request.scopeType}:${request.scopeId}`, request])).values(),
    );

    void Promise.all(uniqueRequests.map(async ({ scopeType, scopeId }) => {
      const query = new URLSearchParams({ scopeType, scopeId });
      const response = await fetch(`/api/pipeline?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) return [] as MediaPipelineRun[];
      const payload = await response.json() as { runs?: MediaPipelineRun[] };
      return payload.runs ?? [];
    }))
      .then((groups) => {
        if (cancelled) return;
        const uniqueRuns = new Map(groups.flat().map((run) => [run.id, run]));
        setPipelineRuns(Array.from(uniqueRuns.values()));
      })
      .catch(() => {
        if (!cancelled) setPipelineRuns([]);
      })
      .finally(() => {
        if (!cancelled) setPipelineContextReady(true);
      });

    return () => { cancelled = true; };
  }, [ownedCharacters, ownedStories]);

  const stopConciergeSpeech = useCallback(() => {
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.src = "";
      speechAudioRef.current = null;
    }
    if (speechUrlRef.current) {
      URL.revokeObjectURL(speechUrlRef.current);
      speechUrlRef.current = "";
    }
  }, []);

  const speakReply = useCallback(async (text: string, onDone: () => void) => {
    stopConciergeSpeech();
    const controller = new AbortController();
    speechRequestRef.current = controller;
    try {
      const response = await fetch("/api/agent/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Natural voice unavailable.");
      const blob = await response.blob();
      if (closedRef.current || controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      speechUrlRef.current = url;
      speechAudioRef.current = audio;
      const finish = () => {
        if (speechAudioRef.current === audio) {
          speechAudioRef.current = null;
          speechRequestRef.current = null;
          URL.revokeObjectURL(url);
          speechUrlRef.current = "";
        }
        if (!closedRef.current) onDone();
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      await audio.play();
    } catch (error) {
      if (controller.signal.aborted || closedRef.current) return;
      console.warn("[concierge] natural speech unavailable:", error instanceof Error ? error.message : error);
      stopConciergeSpeech();
      onDone();
    }
  }, [stopConciergeSpeech]);

  const flushTelemetry = useCallback((outcome: string) => {
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `ccg-${crypto.randomUUID()}`
          : `ccg-${Date.now().toString(36)}`;
    }
    const payload = JSON.stringify({
      sessionId: sessionIdRef.current,
      mode: "push-to-talk",
      steps: stepsRef.current.map((step) => ({ label: step.label, ms: Math.round(step.ms) })),
      outcome,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/agent/telemetry", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/agent/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  }, []);

  const leaveTo = useCallback((href: string, outcome: string) => {
    mark(`Opening ${href.split("?")[0]}`);
    flushTelemetry(outcome);
    if (!closedRef.current) {
      onClose();
      router.push(href);
    }
  }, [flushTelemetry, mark, onClose, router]);

  const openCharacterBuilder = useCallback((input?: {
    name?: string | null;
    brief?: string | null;
    archetypes?: string[];
  }) => {
    const params = new URLSearchParams();
    if (input?.name?.trim()) params.set("cname", input.name.trim());
    if (input?.brief?.trim()) params.set("cbrief", input.brief.trim());
    const archetypes = (input?.archetypes ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter((value) => ALLOWED_ARCHETYPES.includes(value));
    if (archetypes.length) params.set("carchetypes", archetypes.join(","));
    const query = params.toString();
    leaveTo(`/characters/new${query ? `?${query}` : ""}`, "create_character");
  }, [leaveTo]);

  const openVideoBuilder = useCallback((format: "spark" | "punch" | "episode" | "spot", brief?: string | null) => {
    const params = new URLSearchParams({ format });
    if (brief?.trim()) params.set("brief", brief.trim());
    leaveTo(`/studio/write?${params.toString()}`, `create_video:${format}`);
  }, [leaveTo]);

  const submitIntent = useCallback(async (utterance: string) => {
    const text = utterance.trim();
    if (text.length < 3) return;
    setUserLine(text);
    setDraft("");
    setCharacterResultIds([]);
    setProductionResultIds([]);

    setOrbState("thinking");
    setAgentLine("Understanding what you want to make…");
    mark("Understanding");
    try {
      const response = await fetch("/api/agent/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance: text, role, creatorContext }),
      });
      const data = await readIntentResponse(response);
      mark(`Intent: ${data.intent}`);
      if (data.intent === "answer") {
        if (asksForOwnedCharacters(text)) {
          setCharacterResultIds(ownedCharacters.map((character) => character.id));
        }
        if (asksForOwnedProductions(text)) {
          setProductionResultIds(ownedStories.map((story) => story.id));
        }
      }
      if (data.intent !== "answer" && assistantOnly && pathname === "/characters/new") {
        const direction = data.characterBrief ?? data.storyBrief ?? text;
        window.dispatchEvent(new CustomEvent("chaplin:character-assist", {
          detail: { name: data.name, brief: direction, archetypes: data.archetypes },
        }));
        const reply = "Added that direction to this actor.";
        setAgentLine(reply);
        setOrbState("speaking");
        void speakReply(reply, () => setOrbState("idle"));
        return;
      }
      if (data.intent !== "answer" && assistantOnly && pathname.startsWith("/studio/write")) {
        const direction = data.storyBrief ?? data.characterBrief ?? text;
        window.dispatchEvent(new CustomEvent("chaplin:story-assist", {
          detail: { brief: direction },
        }));
        const reply = "Added that direction to this production.";
        setAgentLine(reply);
        setOrbState("speaking");
        void speakReply(reply, () => setOrbState("idle"));
        return;
      }
      setAgentLine(data.reply);
      setOrbState("speaking");
      void speakReply(data.reply, () => {
        if (closedRef.current) return;
        if (data.intent === "create_character") {
          openCharacterBuilder({
            name: data.name,
            brief: data.characterBrief ?? text,
            archetypes: data.archetypes,
          });
        } else if (
          data.intent === "create_spark" ||
          data.intent === "create_punch" ||
          data.intent === "create_episode" ||
          data.intent === "create_spot"
        ) {
          const roleFormat = role === "brand"
            ? "spot"
            : data.intent === "create_spark"
              ? "spark"
              : data.intent === "create_episode"
                ? "episode"
                : data.intent === "create_spot"
                  ? "spot"
                  : "punch";
          openVideoBuilder(roleFormat, data.storyBrief ?? text);
        } else if (data.intent === "create_series") {
          leaveTo("/series/new", "create_series");
        } else if (data.intent === "browse") {
          leaveTo("/characters", "browse");
        } else {
          setOrbState("idle");
        }
      });
    } catch (error) {
      setOrbState("idle");
      setAgentLine(error instanceof Error ? error.message : "Something slipped. Try that again.");
    }
  }, [assistantOnly, creatorContext, leaveTo, mark, openCharacterBuilder, openVideoBuilder, ownedCharacters, ownedStories, pathname, role, speakReply]);

  const startPushToTalk = useCallback(() => {
    if (recognitionRef.current || orbState === "thinking" || orbState === "speaking") return;
    stopConciergeSpeech();
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setAgentLine("Push-to-talk is unavailable in this browser. Type the same thought below.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    transcriptRef.current = "";
    recognitionFailedRef.current = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      mark("Push-to-talk started");
      setUserLine("");
      setAgentLine("");
      setOrbState("listening");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      transcriptRef.current = transcript;
      setDraft(transcript);
      setUserLine(transcript);
    };
    recognition.onerror = (event) => {
      recognitionFailedRef.current = true;
      recognitionRef.current = null;
      setOrbState("idle");
      setAgentLine(
        event.error === "not-allowed"
          ? "Microphone access is off. Allow it once, or type below."
          : "I could not hear that clearly. Hold and try again.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setOrbState("idle");
      const transcript = transcriptRef.current.trim();
      if (!recognitionFailedRef.current && transcript.length >= 3) {
        void submitIntent(transcript);
      } else if (!recognitionFailedRef.current) {
        setAgentLine("Hold the orb, say one thought, then release.");
      }
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setOrbState("idle");
      setAgentLine("The microphone is already busy. Try once more.");
    }
  }, [mark, orbState, stopConciergeSpeech, submitIntent]);

  const stopPushToTalk = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      recognitionRef.current.abort();
    }
  }, []);

  useImperativeHandle(ref, () => ({ startPushToTalk, stopPushToTalk }), [startPushToTalk, stopPushToTalk]);

  function handleClose() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopConciergeSpeech();
    flushTelemetry("closed");
    onClose();
  }

  useEffect(() => {
    closedRef.current = false;
    stepClockRef.current = performance.now();
    return () => {
      closedRef.current = true;
      recognitionRef.current?.abort();
      stopConciergeSpeech();
    };
  }, [stopConciergeSpeech]);

  useEffect(() => {
    onStateChange?.(orbState);
  }, [onStateChange, orbState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let identity = await getClientAuthIdentity();
        if (!identity) return;

        let response = await fetch("/api/drafts", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          identity = await getClientAuthIdentity(true);
          if (identity) {
            response = await fetch("/api/drafts", {
              cache: "no-store",
              credentials: "same-origin",
            });
          }
        }
        const data = await response.json() as { drafts?: DraftSummary[] };
        if (cancelled) return;
        if (identity && response.ok) setSavedDrafts((data.drafts ?? []).slice(0, 3));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Close create menu"
        onClick={handleClose}
        className="fixed inset-0 z-[90] cursor-default bg-black/20 backdrop-blur-[2px]"
      />

      <section
        className="chaplin-scrollbar fixed bottom-[7.25rem] left-1/2 z-[95] max-h-[calc(100dvh-9rem)] w-[calc(100%-1.5rem)] max-w-[34rem] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[1.5rem] border border-white/15 bg-[#0b0e09]/95 p-3.5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:rounded-[1.75rem] sm:p-5"
        data-concierge
        data-mode="push-to-talk"
      >
        <span className="absolute bottom-[-7px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/15 bg-[#0b0e09]" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">
              {assistantOnly ? "Push to talk to Chaplin" : "Create with Chaplin"}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {assistantOnly ? "What should we shape?" : "What do you want to make?"}
            </h2>
            <VoiceStatus state={orbState} />
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-sm text-white/60 hover:border-accent hover:text-white"
          >
            ×
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (orbState === "listening") stopPushToTalk();
            else startPushToTalk();
          }}
          disabled={orbState === "thinking" || orbState === "speaking"}
          className={`mt-3.5 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
            orbState === "listening"
              ? "border-emerald-400/60 bg-emerald-400/10"
              : "border-white/15 bg-white/[0.035] hover:border-accent"
          }`}
          data-concierge-voice-button
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            orbState === "listening"
              ? "bg-emerald-400 text-black shadow-[0_0_24px_rgba(52,211,153,0.42)]"
              : "bg-accent text-paper"
          }`}>
            <IconMicrophone className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {orbState === "listening"
                ? "Listening…"
                : orbState === "thinking"
                  ? "Understanding your idea…"
                  : orbState === "speaking"
                    ? "Chaplin is replying…"
                    : "Tap mic to speak"}
            </span>
          </span>
          <span className="text-accent" aria-hidden="true">
            {orbState === "listening" ? "■" : "→"}
          </span>
        </button>

        {!assistantOnly && (
          <>
        {savedDrafts.length > 0 && (
          <div className="mt-3.5" data-continue-drafts>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-secondary">Continue from there</p>
              <button type="button" onClick={() => leaveTo("/studio", "all_drafts")} className="text-[10px] text-white/45 hover:text-accent">
                View all
              </button>
            </div>
            <div className="grid gap-2">
              {savedDrafts.map((saved) => (
                <button
                  key={saved.id}
                  type="button"
                  onClick={() => leaveTo(`/studio/write?format=${saved.format}&draft=${saved.id}`, `continue_draft:${saved.id}`)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{saved.title || "Untitled draft"}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-white/40">
                      {saved.format === "episode" ? "Episode · 60s" : saved.format === "punch" ? "Punch · 15s" : saved.format === "spark" ? "Spark · 5s" : "Brand Spot"}
                      {saved.logline ? ` · ${saved.logline}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-accent">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="my-3 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">start a new draft</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div
          className={`grid gap-2.5 ${quickOptions.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}
          data-create-choices
        >
          {quickOptions.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => {
                mark(`Create choice: ${option.kind}`);
                leaveTo(option.href, `quick:${option.kind}`);
              }}
              className="group min-w-0 rounded-[1rem] border border-white/15 p-1.5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-accent focus-visible:border-accent focus-visible:outline-none sm:rounded-[1.25rem] sm:p-2"
              data-create-choice={option.kind}
            >
              <QuickOptionVisual kind={option.kind} />
              <span className="block px-1.5 pb-1.5 pt-2.5 sm:px-2 sm:pb-2 sm:pt-3">
                <span className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[13px] font-semibold sm:text-base">{option.title}</span>
                  <span className="text-base text-accent transition-transform group-hover:translate-x-1 sm:text-lg" aria-hidden="true">→</span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[9px] leading-4 text-white/55 sm:text-[11px] sm:leading-5">{option.copy}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="my-3 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">or tell Chaplin once</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
          </>
        )}

        {orbState !== "listening" && (userLine || agentLine) && (
          <div className="mb-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5" aria-live="polite">
            {userLine && <p className="text-[10px] text-white/40">You: {userLine}</p>}
            {agentLine && <p className="mt-1 text-xs leading-5 text-white/80" data-agent-line>{agentLine}</p>}
            {characterResultIds.length > 0 && (
              <div className="chaplin-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1" data-character-results>
                {characterResultIds.map((characterId) => {
                  const character = ownedCharacters.find((candidate) => candidate.id === characterId);
                  if (!character) return null;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => leaveTo(`/characters/${character.id}`, `open_owned_character:${character.id}`)}
                      className="group flex w-36 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 text-left transition hover:border-accent"
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        {character.imageUrl ? (
                          <Image
                            src={character.imageUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-full w-full items-center justify-center text-sm font-semibold"
                            style={{ backgroundColor: `hsl(${character.avatarHue} 28% 20%)` }}
                          >
                            {character.name.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-semibold text-white">{character.name}</span>
                        <span className="mt-0.5 block truncate text-[8px] uppercase tracking-wide text-accent-secondary">
                          {character.archetype.replace("-", " ")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {productionResultIds.length > 0 && (
              <div className="chaplin-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1" data-production-results>
                {productionResultIds.map((storyId) => {
                  const story = ownedStories.find((candidate) => candidate.id === storyId);
                  if (!story) return null;
                  const run = pipelineRuns.find((candidate) => candidate.spec.productionId === story.id);
                  return (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => leaveTo(`/productions/${story.id}`, `open_owned_production:${story.id}`)}
                      className="group w-48 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition hover:border-accent"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-accent">
                          {story.format ?? "story"}
                        </span>
                        <span className={`h-1.5 w-1.5 rounded-full ${run ? "bg-accent-secondary" : "bg-white/25"}`} />
                      </span>
                      <span className="mt-1.5 block truncate text-[11px] font-semibold text-white">{story.title}</span>
                      <span className="mt-1 block truncate text-[9px] text-white/45">
                        {run ? `Pipeline · ${run.currentStep ?? run.status}` : story.status === "production" ? "Ready to initialize" : "Published"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className={assistantOnly ? "mt-4" : ""}>
          <form
            className="flex min-w-0 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitIntent(draft);
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Tell Chaplin what you want to make</span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Or type one idea…"
                className="w-full rounded-full border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-accent focus:outline-none"
                data-concierge-input
              />
            </label>
            <button
              type="submit"
              disabled={orbState === "thinking" || draft.trim().length < 3}
              className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-paper disabled:opacity-40"
            >
              {orbState === "thinking" ? "…" : "Go"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
});

export default ConciergeOrb;
