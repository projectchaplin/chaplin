"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Conversation } from "@elevenlabs/client";

export type ConciergeQuickOption = { href: string; title: string; copy: string };

type OrbState = "idle" | "listening" | "thinking" | "speaking" | "connecting";
type MissionStep = { label: string; ms: number };

type ConciergeIntentResponse = {
  intent: "create_character" | "create_video" | "create_ad" | "create_reel" | "create_series" | "browse" | "unclear";
  name: string | null;
  archetypes: string[];
  characterBrief: string | null;
  storyBrief: string | null;
  reply: string;
  provider?: string;
  error?: string;
};

const ALLOWED_ARCHETYPES = ["villain", "mentor", "love-interest", "comic-relief", "hero", "superhero", "horror", "rebel", "sidekick", "outsider"];

const TIER_PREVIEWS: Record<string, string> = {
  "/characters/new": "New actor → auto 5s Spark audition, then a 15s Punch reel to earn fans.",
  "/studio/write": "A 60s Episode with a cliffhanger — written, cast, and produced.",
  "/studio/write?format=ad": "A 30–60s brand Spot, fronted by an actor your audience follows.",
  "/studio/write?format=reel": "A 15s vertical Punch — hook first, personality forward.",
  "/series/new": "A series pilot: cast, story engine, twelve 5s shots, cliffhanger.",
};

function fallbackSpeak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en[-_](IN|GB)/i.test(voice.lang)) ?? voices.find((voice) => voice.lang.startsWith("en"));
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1.03;
  utterance.onend = () => onDone?.();
  utterance.onerror = () => onDone?.();
  window.speechSynthesis.speak(utterance);
}

export default function ConciergeOrb({
  role,
  quickOptions,
  onClose,
}: {
  role: string;
  quickOptions: ConciergeQuickOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [orbState, setOrbState] = useState<OrbState>("connecting");
  const [agentLine, setAgentLine] = useState("");
  const [userLine, setUserLine] = useState("");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"eleven" | "fallback">("fallback");
  const [steps, setSteps] = useState<MissionStep[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- EL SDK conversation instance
  const conversationRef = useRef<any>(null);
  const closedRef = useRef(false);
  const sessionIdRef = useRef(`ccg-${Math.random().toString(36).slice(2, 10)}`);
  const stepClockRef = useRef(0);
  const stepsRef = useRef<MissionStep[]>([]);
  const modeRef = useRef<"eleven" | "fallback">("fallback");

  const mark = useCallback((label: string) => {
    const now = performance.now();
    const ms = stepClockRef.current ? now - stepClockRef.current : 0;
    stepClockRef.current = now;
    const step = { label, ms };
    stepsRef.current = [...stepsRef.current, step];
    setSteps(stepsRef.current);
  }, []);

  const flushTelemetry = useCallback((outcome: string) => {
    const payload = JSON.stringify({
      sessionId: sessionIdRef.current,
      mode: modeRef.current,
      steps: stepsRef.current.map((step) => ({ label: step.label, ms: Math.round(step.ms) })),
      outcome,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/agent/telemetry", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/agent/telemetry", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
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

  // ---- Client tools the ElevenLabs agent drives ----
  const clientTools = {
    create_character: async ({ name, brief, archetypes }: { name?: string; brief: string; archetypes?: string }) => {
      mark(`Casting ${name || "a new actor"}`);
      const params = new URLSearchParams({ auto: "1" });
      if (name?.trim()) params.set("cname", name.trim());
      if (brief?.trim()) params.set("cbrief", brief.trim());
      const cleanArchetypes = (archetypes ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => ALLOWED_ARCHETYPES.includes(value));
      if (cleanArchetypes.length) params.set("carchetypes", cleanArchetypes.join(","));
      window.setTimeout(() => leaveTo(`/characters/new?${params.toString()}`, `create_character:${name || "unnamed"}`), 1600);
      return "Builder opening — the full identity is now generating in front of them.";
    },
    create_video: async ({ format, brief }: { format: string; brief: string }) => {
      const safeFormat = ["story", "ad", "reel"].includes(format) ? format : "story";
      mark(`Writing a ${safeFormat}`);
      const params = new URLSearchParams({ format: safeFormat, auto: "1" });
      if (brief?.trim()) params.set("brief", brief.trim());
      window.setTimeout(() => leaveTo(`/studio/write?${params.toString()}`, `create_video:${safeFormat}`), 1600);
      return "Writing room opening — the draft is being written for them now.";
    },
    open_page: async ({ path }: { path: string }) => {
      const safePath = typeof path === "string" && path.startsWith("/") ? path : "/characters";
      mark(`Opening ${safePath}`);
      window.setTimeout(() => leaveTo(safePath, `open_page:${safePath}`), 900);
      return "Opening it.";
    },
  };

  // ---- Session bootstrap: try live ElevenLabs voice, fall back to typed intent ----
  useEffect(() => {
    closedRef.current = false;
    stepClockRef.current = performance.now();
    let cancelled = false;

    async function start() {
      try {
        const sessionResponse = await fetch("/api/agent/voice-session", { cache: "no-store" });
        if (!sessionResponse.ok) throw new Error("voice session unavailable");
        const { signedUrl } = (await sessionResponse.json()) as { signedUrl: string };
        mark("Signed session issued");
        const conversation = await Conversation.startSession({
          signedUrl,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clientTools: clientTools as any,
          onConnect: () => {
            if (cancelled) return;
            window.speechSynthesis?.cancel(); // one voice only — the agent's
            modeRef.current = "eleven";
            setMode("eleven");
            setOrbState("listening");
            mark("Voice agent connected");
          },
          onDisconnect: () => {
            if (!closedRef.current) setOrbState("idle");
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMessage: (message: any) => {
            if (cancelled) return;
            const text = typeof message?.message === "string" ? message.message : "";
            if (!text) return;
            if (message.source === "ai") {
              setAgentLine(text);
              mark("Agent replied");
            } else {
              setUserLine(text);
              mark("Heard the user");
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onModeChange: (info: any) => {
            if (cancelled || closedRef.current) return;
            setOrbState(info?.mode === "speaking" ? "speaking" : "listening");
          },
          onError: () => {
            /* surface through fallback below if fatal at start */
          },
        });
        // React dev double-mounts effects: if this instance was cancelled while
        // connecting, kill the session immediately or two agents talk at once.
        if (cancelled || closedRef.current) {
          void conversation.endSession?.();
          return;
        }
        conversationRef.current = conversation;
      } catch {
        if (cancelled) return;
        modeRef.current = "fallback";
        setMode("fallback");
        setOrbState("idle");
        mark("Fallback mode (typed)");
        const greeting = role === "brand" ? "Which face is fronting your next campaign?" : "What are we creating today?";
        setAgentLine(greeting);
        setOrbState("speaking");
        fallbackSpeak(greeting, () => {
          if (!closedRef.current) setOrbState("idle");
        });
      }
    }

    void start();
    return () => {
      cancelled = true;
      closedRef.current = true;
      window.speechSynthesis?.cancel();
      void conversationRef.current?.endSession?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per open
  }, []);

  // ---- Typed path (works in both modes) ----
  async function submitTyped(utterance: string) {
    const text = utterance.trim();
    if (text.length < 3) return;
    setUserLine(text);
    if (modeRef.current === "eleven") {
      if (conversationRef.current?.sendUserMessage) {
        conversationRef.current.sendUserMessage(text);
        setDraft("");
        return;
      }
      // No text channel on this SDK version: hand off cleanly to the typed
      // pipeline — one voice at a time, never both.
      void conversationRef.current?.endSession?.();
      conversationRef.current = null;
      modeRef.current = "fallback";
      setMode("fallback");
      mark("Switched to typed pipeline");
    }
    setOrbState("thinking");
    setAgentLine("Thinking…");
    mark("Understanding");
    try {
      const response = await fetch("/api/agent/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance: text, role }),
      });
      const data = (await response.json()) as ConciergeIntentResponse;
      if (!response.ok) throw new Error(data.error || "The concierge lost the thread.");
      mark(`Intent: ${data.intent}`);
      setAgentLine(data.reply);
      setOrbState("speaking");
      fallbackSpeak(data.reply, () => {
        if (closedRef.current) return;
        if (data.intent === "create_character") {
          void clientTools.create_character({
            name: data.name ?? undefined,
            brief: data.characterBrief ?? text,
            archetypes: data.archetypes.join(","),
          });
        } else if (data.intent === "create_video" || data.intent === "create_ad" || data.intent === "create_reel") {
          void clientTools.create_video({
            format: data.intent === "create_ad" ? "ad" : data.intent === "create_reel" ? "reel" : "story",
            brief: data.storyBrief ?? text,
          });
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
      setAgentLine(error instanceof Error ? error.message : "Something slipped. Say that again?");
    }
  }

  function handleClose() {
    flushTelemetry("closed");
    onClose();
  }

  const orbAnimation =
    orbState === "listening"
      ? "animate-[chaplin-orb-listen_1.1s_ease-in-out_infinite]"
      : orbState === "thinking" || orbState === "connecting"
        ? "animate-[chaplin-orb-think_0.9s_linear_infinite]"
        : "animate-[chaplin-orb-breathe_3.2s_ease-in-out_infinite]";

  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black/80 px-6 backdrop-blur-xl" data-concierge data-mode={mode}>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close the concierge"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-lg text-white/70 transition-colors hover:border-accent hover:text-white"
      >
        ✕
      </button>

      <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-accent">
        Chaplin Concierge {mode === "eleven" ? "· live voice" : ""}
      </p>

      {/* The orb */}
      <div className="relative mt-6 h-36 w-36 rounded-full sm:h-44 sm:w-44" data-orb-state={orbState}>
        <span className={`absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#ff5c8a,transparent_55%),radial-gradient(circle_at_70%_72%,#20d9d2,transparent_55%),radial-gradient(circle_at_50%_50%,#7b6cff,#12060e_78%)] shadow-[0_0_70px_rgba(244,70,112,0.4),0_0_110px_rgba(32,217,210,0.25)] ${orbAnimation}`} />
        <span className="absolute inset-[14%] rounded-full bg-white/5 backdrop-blur-[2px]" />
        {orbState === "connecting" && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-widest text-white/80">Connecting…</span>
        )}
      </div>

      {/* Conversation lines */}
      <div className="mt-6 flex min-h-16 max-w-md flex-col items-center gap-1.5 text-center">
        {userLine && <p className="text-xs text-white/50">“{userLine}”</p>}
        <p className="text-base leading-6 text-white sm:text-lg" aria-live="assertive" data-agent-line>
          {agentLine || (mode === "eleven" ? "Just talk — I'm listening." : "")}
        </p>
      </div>

      {/* Typed input works in both modes */}
      <form
        className="mt-4 flex w-full max-w-md items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitTyped(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={mode === "eleven" ? "Or type it instead of talking" : "Type what you want to make"}
          className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
          data-concierge-input
        />
        <button
          type="submit"
          disabled={orbState === "thinking" || draft.trim().length < 3}
          className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          {orbState === "thinking" ? "…" : "Go"}
        </button>
      </form>

      {/* Quick paths, with what each one actually makes */}
      <div className="mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2">
        {quickOptions.map((option) => (
          <button
            key={option.href}
            type="button"
            title={TIER_PREVIEWS[option.href] ?? option.copy}
            onClick={() => {
              mark(`Quick: ${option.title}`);
              setAgentLine(TIER_PREVIEWS[option.href] ?? option.copy);
              window.setTimeout(() => leaveTo(option.href, `quick:${option.href}`), 1100);
            }}
            className="rounded-full border border-white/20 px-3.5 py-1.5 text-[11px] font-semibold text-white/75 transition-colors hover:border-accent hover:text-white"
          >
            {option.title}
          </button>
        ))}
      </div>

      {/* Mission log: every step, timed */}
      {steps.length > 0 && (
        <div className="absolute bottom-5 left-5 hidden w-64 sm:block" data-mission-log>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">Mission log</p>
          <ul className="flex flex-col gap-1">
            {steps.slice(-6).map((step, index) => (
              <li key={`${step.label}-${index}`} className="flex items-baseline justify-between gap-3 text-[11px] text-white/70">
                <span className="truncate">{step.label}</span>
                <span className="shrink-0 tabular-nums text-white/35">{step.ms >= 1000 ? `${(step.ms / 1000).toFixed(1)}s` : `${Math.round(step.ms)}ms`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
