"use client";

import Link from "next/link";
import { useState } from "react";
import { useChaplinStore } from "@/lib/store";
import type { AppRole } from "@/lib/types";
import Avatar from "@/components/Avatar";
import HydrateStore from "@/components/HydrateStore";

const ROLE_META: Record<AppRole, { label: string; short: string; description: string }> = {
  maker: {
    label: "Actor Maker",
    short: "Maker",
    description: "Build actors, voices, media, and track earnings.",
  },
  caster: {
    label: "Caster",
    short: "Caster",
    description: "Discover actors and cast them into stories.",
  },
  admin: {
    label: "Super Admin",
    short: "Admin",
    description: "Inspect readiness, spend, jobs, and platform operations.",
  },
};

const ROLE_ORDER: AppRole[] = ["maker", "caster", "admin"];

export default function Header() {
  const users = useChaplinStore((state) => state.users);
  const currentUserId = useChaplinStore((state) => state.currentUserId);
  const activeRole = useChaplinStore((state) => state.activeRole);
  const setCurrentUser = useChaplinStore((state) => state.setCurrentUser);
  const switchDemoRole = useChaplinStore((state) => state.switchDemoRole);
  const [open, setOpen] = useState(false);

  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0];
  const roleUsers = users.filter((user) => user.roleBadges.includes(activeRole));
  const contextLink = activeRole === "admin"
    ? { href: "/admin", label: "Admin" }
    : activeRole === "maker"
      ? { href: "/studio", label: "Maker Studio" }
      : { href: "/characters", label: "Start casting" };

  return (
    <header className="sticky top-0 z-[70] bg-paper/90 backdrop-blur-xl border-b border-line">
      <HydrateStore />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="accent-rule w-6 rounded-full" />
          <span className="marquee-title text-xl sm:text-2xl leading-none tracking-widest">CHAPLIN</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href={contextLink.href} className="hidden sm:block text-[10px] uppercase tracking-wider text-grey hover:text-accent">
            {contextLink.label}
          </Link>
          <div className="relative">
            <button
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label="Switch demo login and role"
              className={`flex items-center gap-2 rounded-full border px-1.5 py-1 transition-colors ${open ? "border-accent bg-white/[0.06]" : "border-line hover:border-accent"}`}
            >
              {currentUser && (
                <span className="accent-ring">
                  <Avatar hue={currentUser.avatarHue} label={currentUser.avatarInitial} src={currentUser.imageUrl} size={32} />
                </span>
              )}
              <span className="text-left pr-2 max-w-32 sm:max-w-44">
                <span className="block text-xs sm:text-sm leading-tight font-medium truncate">{currentUser?.name}</span>
                <span className="block leading-tight text-[9px] sm:text-[10px] text-accent uppercase tracking-wide truncate">
                  {ROLE_META[activeRole].label}
                </span>
              </span>
            </button>

            {open && (
              <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[4.25rem] sm:top-auto sm:mt-2 sm:w-[24rem] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-line bg-paper-dim shadow-2xl p-3 z-[90]">
                <div className="flex items-start justify-between gap-3 px-1 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">Quick view switch</p>
                    <p className="text-xs text-grey mt-1">Jump between complete role-specific demo sessions.</p>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-grey hover:text-ink text-lg leading-none" aria-label="Close role switcher">×</button>
                </div>

                <div className="grid sm:grid-cols-3 gap-2 mb-4">
                  {ROLE_ORDER.map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        switchDemoRole(role);
                        setOpen(false);
                      }}
                      className={`rounded-md border p-3 text-left transition-colors ${activeRole === role ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
                    >
                      <span className="block text-xs font-semibold">{ROLE_META[role].label}</span>
                      <span className="block text-[10px] text-grey mt-1 leading-snug">{ROLE_META[role].description}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-line pt-3">
                  <p className="text-[10px] uppercase tracking-wide text-grey px-1 mb-1">
                    Demo logins for {ROLE_META[activeRole].label}
                  </p>
                  {roleUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setCurrentUser(user.id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-left hover:bg-white/[0.06] ${user.id === currentUserId ? "bg-white/[0.06]" : ""}`}
                    >
                      <Avatar hue={user.avatarHue} label={user.avatarInitial} src={user.imageUrl} size={30} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{user.name}</span>
                        <span className="block text-[10px] text-grey truncate">{user.handle} · {ROLE_META[activeRole].short}</span>
                      </span>
                      {user.id === currentUserId && <span className="text-accent text-xs">●</span>}
                    </button>
                  ))}
                </div>

                <div className="border-t border-line mt-3 pt-3 px-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-grey">Navigation and actions update immediately.</span>
                  {activeRole === "maker" && (
                    <Link href="/characters/new" onClick={() => setOpen(false)} className="text-xs text-accent hover:underline whitespace-nowrap">
                      + New actor
                    </Link>
                  )}
                  {activeRole === "admin" && (
                    <Link href="/admin" onClick={() => setOpen(false)} className="text-xs text-accent hover:underline whitespace-nowrap">
                      Open admin →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
