"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import { IconFilm, IconHome, IconMask } from "@/components/Icons";

const TABS = [
  { href: "/feed", label: "Feed", Icon: IconHome },
  { href: "/characters", label: "Actors", Icon: IconMask },
  { href: "/series", label: "Watch", Icon: IconFilm },
] as const;

type CreateOption = { href: string; title: string; copy: string };

// Role-aware create paths: creators build identities and videos; brands make
// ads and reels; casters go straight to writing something shootable.
const CREATE_OPTIONS: Record<string, CreateOption[]> = {
  brand: [
    { href: "/studio/write?format=ad", title: "Create an ad", copy: "A 30–60s spot with an AI actor your audience follows." },
    { href: "/studio/write?format=reel", title: "Create a reel", copy: "Short vertical branded content, hook-first." },
  ],
  caster: [
    { href: "/studio/write", title: "Create a video", copy: "Cast actors into a scene and produce it." },
    { href: "/series/new", title: "Build a series pilot", copy: "Lock the cast and the cliffhanger engine." },
  ],
  creator: [
    { href: "/characters/new", title: "Create a character", copy: "Face, voice, signature sound, and continuity rules." },
    { href: "/studio/write", title: "Create a video", copy: "Write something shootable and produce it." },
    { href: "/series/new", title: "Build a series pilot", copy: "Twelve five-second shots and a cliffhanger." },
  ],
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();
  const activeRole = useChaplinStore((s) => s.activeRole);
  const [createOpen, setCreateOpen] = useState(false);
  const feed = TABS[0];
  const actors = TABS[1];
  const watch = TABS[2];
  const FeedIcon = feed.Icon;
  const ActorsIcon = actors.Icon;
  const WatchIcon = watch.Icon;
  const createOptions = CREATE_OPTIONS[activeRole === "brand" ? "brand" : activeRole === "caster" ? "caster" : "creator"];

  // Close the create menu on navigation.
  useEffect(() => {
    setCreateOpen(false);
  }, [pathname]);

  const navItemClass =
    "group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 pb-2 pt-3 text-[10px] font-semibold tracking-[0.04em] transition-colors sm:text-[11px]";

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] sm:px-5"
    >
      {createOpen && (
        <button
          type="button"
          aria-label="Close create menu"
          onClick={() => setCreateOpen(false)}
          className="pointer-events-auto fixed inset-0 z-0 cursor-default bg-black/40 backdrop-blur-[2px]"
        />
      )}
      <div className="pointer-events-auto relative mx-auto w-full max-w-[34rem]">
        {createOpen && (
          <div
            role="menu"
            aria-label="Create"
            className="absolute bottom-[calc(100%+2.6rem)] left-1/2 z-20 w-[min(92vw,22rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-black/85 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl motion-safe:animate-[chaplin-format-enter_200ms_ease-out]"
            data-create-menu
          >
            <p className="border-b border-white/10 px-4 pb-2.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              {activeRole === "brand" ? "Create for your brand" : "What are you making?"}
            </p>
            {createOptions.map((option) => (
              <Link
                key={option.href}
                role="menuitem"
                href={option.href}
                onClick={() => setCreateOpen(false)}
                className="block border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-white/5"
              >
                <span className="block text-sm font-semibold text-white">{option.title}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-white/55">{option.copy}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Floating create button — sits in the notch the bar masks out below */}
        <button
          type="button"
          aria-label="Create"
          aria-expanded={createOpen}
          onClick={() => setCreateOpen((open) => !open)}
          className="absolute left-1/2 top-0 z-10 flex h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-[52%] items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff2f6d_8%,#d57eaf_48%,#20d9d2_88%)] p-[2px] shadow-[0_0_28px_rgba(32,217,210,0.25),0_0_24px_rgba(255,47,109,0.2)] transition-transform duration-200 hover:-translate-y-[58%] sm:h-[4.75rem] sm:w-[4.75rem]"
          data-create-toggle
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#090b08] shadow-[inset_0_0_22px_rgba(255,255,255,0.05)]">
            <span
              aria-hidden="true"
              className={`-mt-1 text-[2.65rem] font-extralight leading-none text-white transition-transform duration-200 ${createOpen ? "rotate-45" : ""}`}
            >
              +
            </span>
          </span>
        </button>
        <div className="flex h-[5rem] w-full items-stretch rounded-[2rem] border border-white/15 bg-black/75 px-2 shadow-[0_16px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl [-webkit-mask-image:radial-gradient(circle_at_50%_0px,transparent_40px,black_41px)] [mask-image:radial-gradient(circle_at_50%_0px,transparent_40px,black_41px)] sm:h-[5.25rem] sm:px-4 sm:[-webkit-mask-image:radial-gradient(circle_at_50%_0px,transparent_44px,black_45px)] sm:[mask-image:radial-gradient(circle_at_50%_0px,transparent_44px,black_45px)]">
        <Link
          href={feed.href}
          aria-current={isActive(pathname, feed.href) ? "page" : undefined}
          className={`${navItemClass} ${isActive(pathname, feed.href) ? "text-white" : "text-white/55 hover:text-white"}`}
        >
          <span className="relative">
            <FeedIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            {isActive(pathname, feed.href) && (
              <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[#f34b72] shadow-[0_0_10px_#f34b72]" />
            )}
          </span>
          <span>{feed.label}</span>
        </Link>

        <Link
          href={actors.href}
          aria-current={isActive(pathname, actors.href) ? "page" : undefined}
          className={`${navItemClass} ${isActive(pathname, actors.href) ? "text-white" : "text-white/55 hover:text-white"}`}
        >
          <ActorsIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          <span>{actors.label}</span>
        </Link>

        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setCreateOpen((open) => !open)}
          className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 pb-2 pt-3 text-[10px] font-semibold tracking-[0.04em] text-white sm:text-[11px]"
        >
          <span>Create</span>
        </button>

        <Link
          href={watch.href}
          aria-current={isActive(pathname, watch.href) ? "page" : undefined}
          className={`${navItemClass} ${isActive(pathname, watch.href) ? "text-white" : "text-white/55 hover:text-white"}`}
        >
          <WatchIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          <span>{watch.label}</span>
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
