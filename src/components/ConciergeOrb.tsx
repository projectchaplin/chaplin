"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBriefcase, IconFilm, IconLock, IconMask, IconReceipt } from "@/components/Icons";

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
  intent: "create_character" | "create_spark" | "create_punch" | "create_episode" | "create_spot" | "create_series" | "browse" | "unclear";
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
      <span className="relative block h-28 overflow-hidden rounded-[1rem] border border-white/12">
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
        <span className="absolute bottom-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-black" />
        </span>
        <span className="absolute bottom-3 right-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80">
          Spark · Punch · Episode
        </span>
      </span>
    );
  }

  if (kind === "actor") {
    return (
      <span className="relative flex h-28 items-center justify-center overflow-hidden rounded-[1rem] border border-white/12">
        <span className="absolute h-24 w-24 rounded-full border border-accent/30 shadow-[0_0_40px_rgba(255,47,109,0.18)]" />
        <span className="absolute h-16 w-16 rounded-full border border-accent-secondary/25" />
        <IconMask className="relative h-12 w-12 text-white" />
        <span className="absolute bottom-3 left-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
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
              : "Voice off · Hold orb"}
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

function fallbackSpeak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((voice) => /ravi|rishi|prabhat|madhur/i.test(voice.name)) ??
    voices.find((voice) => /en[-_]IN/i.test(voice.lang)) ??
    voices.find((voice) => /daniel|george|ryan/i.test(voice.name) && voice.lang.startsWith("en")) ??
    voices.find((voice) => voice.lang.startsWith("en"));
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1.03;
  utterance.onend = () => onDone?.();
  utterance.onerror = () => onDone?.();
  window.speechSynthesis.speak(utterance);
}

const ConciergeOrb = forwardRef<ConciergeOrbHandle, {
  role: string;
  quickOptions: ConciergeQuickOption[];
  onClose: () => void;
  onStateChange?: (state: ConciergeOrbState) => void;
}>(function ConciergeOrb({
  role,
  quickOptions,
  onClose,
  onStateChange,
}, ref) {
  const router = useRouter();
  const [orbState, setOrbState] = useState<ConciergeOrbState>("idle");
  const [agentLine, setAgentLine] = useState("");
  const [userLine, setUserLine] = useState("");
  const [draft, setDraft] = useState("");
  const [savedDrafts, setSavedDrafts] = useState<DraftSummary[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsNeedLogin, setDraftsNeedLogin] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const recognitionFailedRef = useRef(false);
  const closedRef = useRef(false);
  const sessionIdRef = useRef("");
  const stepClockRef = useRef(0);
  const stepsRef = useRef<MissionStep[]>([]);
  const mark = useCallback((label: string) => {
    const now = performance.now();
    const ms = stepClockRef.current ? now - stepClockRef.current : 0;
    stepClockRef.current = now;
    stepsRef.current = [...stepsRef.current, { label, ms }];
  }, []);

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
    setOrbState("thinking");
    setAgentLine("Understanding what you want to make…");
    mark("Understanding");
    try {
      const response = await fetch("/api/agent/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance: text, role }),
      });
      const data = await readIntentResponse(response);
      mark(`Intent: ${data.intent}`);
      setAgentLine(data.reply);
      setOrbState("speaking");
      fallbackSpeak(data.reply, () => {
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
  }, [leaveTo, mark, openCharacterBuilder, openVideoBuilder, role]);

  const startPushToTalk = useCallback(() => {
    if (recognitionRef.current || orbState === "thinking" || orbState === "speaking") return;
    window.speechSynthesis?.cancel();
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setAgentLine("Push-to-talk is unavailable in this browser. Type the same thought below.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    transcriptRef.current = "";
    recognitionFailedRef.current = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      mark("Push-to-talk started");
      setUserLine("");
      setAgentLine("Listening only while you hold…");
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
  }, [mark, orbState, submitIntent]);

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
    window.speechSynthesis?.cancel();
    flushTelemetry("closed");
    onClose();
  }

  useEffect(() => {
    closedRef.current = false;
    stepClockRef.current = performance.now();
    return () => {
      closedRef.current = true;
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    onStateChange?.(orbState);
  }, [onStateChange, orbState]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/drafts", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { drafts?: DraftSummary[] };
        if (cancelled) return;
        if (response.status === 401) setDraftsNeedLogin(true);
        else if (response.ok) setSavedDrafts((data.drafts ?? []).slice(0, 3));
      })
      .finally(() => { if (!cancelled) setDraftsLoading(false); });
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
        className="chaplin-scrollbar fixed bottom-[7.25rem] left-1/2 z-[95] max-h-[calc(100dvh-9rem)] w-[calc(100%-1.5rem)] max-w-[34rem] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[1.75rem] border border-white/15 bg-[#0b0e09]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-5"
        data-concierge
        data-mode="push-to-talk"
      >
        <span className="absolute bottom-[-7px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/15 bg-[#0b0e09]" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">Create with Chaplin</p>
            <h2 className="mt-1 text-xl font-semibold">What do you want to make?</h2>
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

        <div className="mt-4" data-continue-drafts>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-secondary">Continue from Draft</p>
            {savedDrafts.length > 0 && (
              <button type="button" onClick={() => leaveTo("/studio", "all_drafts")} className="text-[10px] text-white/45 hover:text-accent">
                View all
              </button>
            )}
          </div>
          {draftsLoading ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-xs text-white/40">Finding your latest draft…</div>
          ) : draftsNeedLogin ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/12 px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/55">
                <IconLock className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-white">Your drafts</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-white/45">Sign in to continue where you left off.</span>
              </span>
              <button
                type="button"
                onClick={() => leaveTo("/auth?next=/studio", "sign_in_for_drafts")}
                className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Sign in
              </button>
            </div>
          ) : savedDrafts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-xs text-white/40">Your first idea will autosave here.</div>
          ) : (
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
          )}
        </div>

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">start a new draft</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div
          className={`grid grid-cols-1 gap-3 ${quickOptions.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
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
              className="group rounded-[1.25rem] border border-white/15 p-2 text-left transition duration-300 hover:-translate-y-0.5 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
              data-create-choice={option.kind}
            >
              <QuickOptionVisual kind={option.kind} />
              <span className="block px-2 pb-2 pt-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold">{option.title}</span>
                  <span className="text-lg text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-white/55">{option.copy}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">or tell Chaplin once</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {(userLine || agentLine) && (
          <div className="mb-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5" aria-live="polite">
            {userLine && <p className="text-[10px] text-white/40">You: {userLine}</p>}
            {agentLine && <p className="mt-1 text-xs leading-5 text-white/80" data-agent-line>{agentLine}</p>}
          </div>
        )}

        <div>
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
              className="mt-4 shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-paper disabled:opacity-40"
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
