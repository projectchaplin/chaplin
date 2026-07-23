"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ConciergeOrb, {
  type ConciergeOrbHandle,
  type ConciergeOrbState,
  type ConciergeQuickOption,
} from "@/components/ConciergeOrb";
import { IconActors, IconFeed, IconFilm } from "@/components/Icons";
import { useChaplinStore } from "@/lib/store";

const CREATE_OPTIONS: Record<"brand" | "creator" | "admin", ConciergeQuickOption[]> = {
  brand: [
    {
      kind: "ad",
      href: "/studio/write?format=spot&duration=30",
      title: "Create an ad",
      copy: "Build a product-led spot with rights and approval gates.",
    },
    {
      kind: "reel",
      href: "/studio/write?format=spot&duration=30",
      title: "Create a reel",
      copy: "Start a short branded performance made for the feed.",
    },
    {
      kind: "micro-drama",
      href: "/studio/write?format=spot&duration=60",
      title: "Create a micro drama",
      copy: "Build a 60-second branded story ending on a cliffhanger.",
    },
  ],
  creator: [
    {
      kind: "actor",
      href: "/characters/new",
      title: "Build an AI actor",
      copy: "Develop an original face, voice, identity, and performance world.",
    },
    {
      kind: "video",
      href: "/studio/write?format=punch",
      title: "Make a scene",
      copy: "Start with an idea, then shape it as a Spark, Punch, or Episode.",
    },
  ],
  admin: [
    {
      kind: "pipeline",
      href: "/studio/pipelines",
      title: "Pipeline map",
      copy: "Inspect every output contract and approval gate.",
    },
    {
      kind: "operations",
      href: "/admin",
      title: "Production operations",
      copy: "Inspect provider readiness, jobs, failures, and spend.",
    },
  ],
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isCreationWorkspace(pathname: string) {
  return (
    pathname === "/create" ||
    pathname === "/characters/new" ||
    pathname.startsWith("/studio/write") ||
    pathname.startsWith("/series/new") ||
    pathname.startsWith("/productions/")
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const activeRole = useChaplinStore((state) => state.activeRole);
  const [createOpenAt, setCreateOpenAt] = useState<string | null>(null);
  const [orbState, setOrbState] = useState<ConciergeOrbState>("idle");
  const conciergeRef = useRef<ConciergeOrbHandle | null>(null);
  const holdRequestedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const pointerHeldRef = useRef(false);
  const holdTriggeredRef = useRef(false);
  const suppressClickRef = useRef(false);
  const createOpen = createOpenAt === pathname;
  const assistantMode = isCreationWorkspace(pathname);
  const createOptions = activeRole === "brand"
    ? CREATE_OPTIONS.brand
    : activeRole === "admin"
      ? CREATE_OPTIONS.admin
      : CREATE_OPTIONS.creator;
  const navItemClass =
    "group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 pb-2 pt-3 text-[10px] font-semibold tracking-[0.04em] transition-colors sm:text-[11px]";

  function toggleCreate() {
    setCreateOpenAt((openAt) => openAt === pathname ? null : pathname);
  }

  const connectConcierge = useCallback((node: ConciergeOrbHandle | null) => {
    conciergeRef.current = node;
    if (!node || !holdRequestedRef.current) return;
    holdRequestedRef.current = false;
    if (pointerHeldRef.current) node.startPushToTalk();
  }, []);

  useEffect(() => () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
  }, []);

  function startOrbHold(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || orbState === "thinking" || orbState === "speaking") return;
    pointerHeldRef.current = true;
    holdTriggeredRef.current = false;
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimerRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true;
      suppressClickRef.current = true;
      if (createOpen) conciergeRef.current?.startPushToTalk();
      else {
        holdRequestedRef.current = true;
        setCreateOpenAt(pathname);
      }
    }, 260);
  }

  function finishOrbHold() {
    pointerHeldRef.current = false;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdTriggeredRef.current) conciergeRef.current?.stopPushToTalk();
  }

  function handleOrbClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!createOpen) {
      setCreateOpenAt(pathname);
      return;
    }
    if (orbState === "listening") conciergeRef.current?.stopPushToTalk();
    else if (orbState === "idle") conciergeRef.current?.startPushToTalk();
  }

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] sm:px-5"
    >
      {createOpen && (
        <div className="pointer-events-auto">
          <ConciergeOrb
            ref={connectConcierge}
            role={activeRole}
            quickOptions={createOptions}
            assistantOnly={assistantMode}
            onStateChange={setOrbState}
            onClose={() => {
              setOrbState("idle");
              setCreateOpenAt(null);
            }}
          />
        </div>
      )}

      <div className="pointer-events-auto relative mx-auto w-full max-w-[34rem]">
        <button
          type="button"
          aria-label={
            createOpen
              ? orbState === "listening"
                ? "Release to send your idea"
                : "Hold to speak to Chaplin"
              : "Open Create"
          }
          aria-expanded={createOpen}
          onClick={handleOrbClick}
          onPointerDown={startOrbHold}
          onPointerUp={finishOrbHold}
          onPointerCancel={finishOrbHold}
          onKeyDown={(event) => {
            if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
            event.preventDefault();
            pointerHeldRef.current = true;
            if (createOpen) conciergeRef.current?.startPushToTalk();
            else {
              holdRequestedRef.current = true;
              setCreateOpenAt(pathname);
            }
          }}
          onKeyUp={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            pointerHeldRef.current = false;
            conciergeRef.current?.stopPushToTalk();
          }}
          onContextMenu={(event) => event.preventDefault()}
          className="absolute left-1/2 top-0 z-10 flex h-[4.25rem] w-[4.25rem] touch-none select-none -translate-x-1/2 -translate-y-[52%] items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff2f6d_8%,#d57eaf_48%,#20d9d2_88%)] p-[2px] shadow-[0_0_12px_rgba(32,217,210,0.14),0_0_10px_rgba(255,47,109,0.12)] transition-transform duration-200 hover:-translate-y-[58%] sm:h-[4.75rem] sm:w-[4.75rem]"
          data-create-toggle
          data-create-orb={createOpen ? "active" : "idle"}
          data-push-to-talk={createOpen ? "true" : undefined}
          data-orb-state={createOpen ? orbState : "closed"}
        >
          {createOpen && orbState === "listening" && (
            <>
              <span className="pointer-events-none absolute -inset-2 animate-ping rounded-full border border-emerald-400/55" />
              <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.75)]" />
            </>
          )}
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#090b08] shadow-[inset_0_0_22px_rgba(255,255,255,0.05)]">
            <span aria-hidden="true" className="relative h-[82%] w-[82%]">
              <span className="chaplin-orb-alive absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,92,138,0.72),transparent_54%),radial-gradient(circle_at_70%_72%,rgba(32,217,210,0.66),transparent_56%),#160f18] shadow-[inset_0_0_12px_rgba(255,255,255,0.06),0_0_7px_rgba(32,217,210,0.2)]" />
              <span className="chaplin-orb-life-ring pointer-events-none absolute -inset-1 rounded-full border border-accent-secondary/35" />
              <span
                aria-hidden="true"
                className={`absolute inset-0 flex items-center justify-center pb-0.5 text-[2.25rem] font-extralight leading-none text-white transition sm:text-[2.6rem] ${
                  orbState === "listening" ? "scale-110" : orbState === "thinking" ? "scale-95 opacity-70" : "scale-100"
                }`}
              >
                +
              </span>
            </span>
          </span>
        </button>

        <div className="flex h-[5rem] w-full items-stretch rounded-[2rem] border border-white/15 bg-black/75 px-2 shadow-[0_16px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl [-webkit-mask-image:radial-gradient(circle_at_50%_0px,transparent_40px,black_41px)] [mask-image:radial-gradient(circle_at_50%_0px,transparent_40px,black_41px)] sm:h-[5.25rem] sm:px-4 sm:[-webkit-mask-image:radial-gradient(circle_at_50%_0px,transparent_44px,black_45px)] sm:[mask-image:radial-gradient(circle_at_50%_0px,transparent_44px,black_45px)]">
          <Link
            href="/feed"
            aria-current={isActive(pathname, "/feed") ? "page" : undefined}
            className={`${navItemClass} ${isActive(pathname, "/feed") ? "text-white" : "text-white/55 hover:text-white"}`}
          >
            <span className="relative">
              <IconFeed className="h-6 w-6 sm:h-7 sm:w-7" />
              {isActive(pathname, "/feed") && (
                <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[#f34b72] shadow-[0_0_10px_#f34b72]" />
              )}
            </span>
            <span>Feed</span>
          </Link>

          <Link
            href="/characters"
            aria-current={isActive(pathname, "/characters") ? "page" : undefined}
            className={`${navItemClass} ${isActive(pathname, "/characters") ? "text-white" : "text-white/55 hover:text-white"}`}
          >
            <IconActors className="h-6 w-6 sm:h-7 sm:w-7" />
            <span>Actors</span>
          </Link>

          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={toggleCreate}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 pb-2 pt-3 text-[10px] font-semibold tracking-[0.04em] text-white sm:text-[11px]"
          >
            <span>Create</span>
          </button>

          <Link
            href="/series"
            aria-current={isActive(pathname, "/series") ? "page" : undefined}
            className={`${navItemClass} ${isActive(pathname, "/series") ? "text-white" : "text-white/55 hover:text-white"}`}
          >
            <IconFilm className="h-6 w-6 sm:h-7 sm:w-7" />
            <span>Watch</span>
          </Link>

          <Link
            href="/studio"
            aria-current={isActive(pathname, "/studio") ? "page" : undefined}
            className={`${navItemClass} ${isActive(pathname, "/studio") ? "text-white" : "text-white/55 hover:text-white"}`}
          >
            <Image
              src="/brand/chaplin-mark.png"
              alt=""
              width={36}
              height={36}
              className={`h-8 w-8 object-contain transition-transform ${isActive(pathname, "/studio") ? "scale-110" : ""}`}
            />
            <span>Studio</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
