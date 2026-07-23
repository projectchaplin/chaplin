"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConciergeOrb, {
  type ConciergeOrbHandle,
  type ConciergeOrbState,
  type ConciergeQuickOption,
} from "@/components/ConciergeOrb";
import { IconFilm, IconHome, IconMask } from "@/components/Icons";
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

export default function BottomNav() {
  const pathname = usePathname();
  const activeRole = useChaplinStore((state) => state.activeRole);
  const [createOpenAt, setCreateOpenAt] = useState<string | null>(null);
  const [orbState, setOrbState] = useState<ConciergeOrbState>("idle");
  const conciergeRef = useRef<ConciergeOrbHandle>(null);
  const pointerHeldRef = useRef(false);
  const startWhenReadyRef = useRef(false);
  const openedFromPointerRef = useRef(false);
  const createOpen = createOpenAt === pathname;
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

  useEffect(() => {
    if (!createOpen || !startWhenReadyRef.current || !pointerHeldRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (!pointerHeldRef.current) return;
      startWhenReadyRef.current = false;
      conciergeRef.current?.startPushToTalk();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [createOpen]);

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] sm:px-5"
    >
      {createOpen && (
        <div className="pointer-events-auto">
          <ConciergeOrb
            ref={conciergeRef}
            role={activeRole}
            quickOptions={createOptions}
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
          aria-label={createOpen ? "Hold to talk to Chaplin" : "Create"}
          aria-expanded={createOpen}
          onClick={() => {
            if (openedFromPointerRef.current) {
              openedFromPointerRef.current = false;
              return;
            }
            if (!createOpen) toggleCreate();
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerHeldRef.current = true;
            if (createOpen) {
              conciergeRef.current?.startPushToTalk();
            } else {
              openedFromPointerRef.current = true;
              startWhenReadyRef.current = true;
              setCreateOpenAt(pathname);
            }
          }}
          onPointerUp={() => {
            pointerHeldRef.current = false;
            startWhenReadyRef.current = false;
            conciergeRef.current?.stopPushToTalk();
          }}
          onPointerCancel={() => {
            pointerHeldRef.current = false;
            startWhenReadyRef.current = false;
            conciergeRef.current?.stopPushToTalk();
          }}
          onKeyDown={(event) => {
            if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
            pointerHeldRef.current = true;
            if (createOpen) {
              conciergeRef.current?.startPushToTalk();
            } else {
              startWhenReadyRef.current = true;
              setCreateOpenAt(pathname);
            }
          }}
          onKeyUp={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            pointerHeldRef.current = false;
            startWhenReadyRef.current = false;
            conciergeRef.current?.stopPushToTalk();
          }}
          className="absolute left-1/2 top-0 z-10 flex h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-[52%] items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff2f6d_8%,#d57eaf_48%,#20d9d2_88%)] p-[2px] shadow-[0_0_28px_rgba(32,217,210,0.25),0_0_24px_rgba(255,47,109,0.2)] transition-transform duration-200 hover:-translate-y-[58%] sm:h-[4.75rem] sm:w-[4.75rem]"
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
              <span className={`absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#ff5c8a,transparent_52%),radial-gradient(circle_at_70%_72%,#20d9d2,transparent_54%),radial-gradient(circle_at_50%_48%,#776dff,transparent_70%),#241020] shadow-[inset_0_0_16px_rgba(255,255,255,0.09),0_0_20px_rgba(32,217,210,0.38)] ${orbState === "listening" ? "animate-pulse" : ""}`} />
              <span className={`absolute inset-0 flex items-center justify-center font-light text-white drop-shadow-md ${createOpen ? "text-[8px] font-bold uppercase tracking-wide" : "-mt-0.5 text-[2rem]"}`}>
                {createOpen ? (orbState === "listening" ? "Talk" : orbState === "thinking" ? "…" : "Hold") : "+"}
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
              <IconHome className="h-6 w-6 sm:h-7 sm:w-7" />
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
            <IconMask className="h-6 w-6 sm:h-7 sm:w-7" />
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
              width={32}
              height={32}
              className="h-7 w-7 object-contain sm:h-8 sm:w-8"
            />
            <span>Studio</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
