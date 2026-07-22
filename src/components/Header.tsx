"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useChaplinStore } from "@/lib/store";
import type { AppRole } from "@/lib/types";
import Avatar from "@/components/Avatar";
import HydrateStore from "@/components/HydrateStore";

type AuthIdentity = { id: string; email: string; name: string; role: "creator" | "brand" | "admin" };

const ROLE_META: Record<AppRole, { label: string; short: string; description: string }> = {
  maker: {
    label: "Creator",
    short: "Creator",
    description: "Post, collaborate, build identities, and develop series.",
  },
  caster: {
    label: "Creator",
    short: "Creator",
    description: "Post, collaborate, build identities, and develop series.",
  },
  brand: {
    label: "Creator",
    short: "Creator",
    description: "Post, collaborate, build identities, and develop series.",
  },
  admin: {
    label: "Super Admin",
    short: "Admin",
    description: "Inspect readiness, spend, jobs, and platform operations.",
  },
};

const ROLE_ORDER: AppRole[] = ["maker", "admin"];

export default function Header() {
  const users = useChaplinStore((state) => state.users);
  const currentUserId = useChaplinStore((state) => state.currentUserId);
  const activeRole = useChaplinStore((state) => state.activeRole);
  const setCurrentUser = useChaplinStore((state) => state.setCurrentUser);
  const switchDemoRole = useChaplinStore((state) => state.switchDemoRole);
  const syncAuthenticatedUser = useChaplinStore((state) => state.syncAuthenticatedUser);
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [authIdentity, setAuthIdentity] = useState<AuthIdentity | null>(null);

  useEffect(() => {
    const updateHeader = () => setCompact(window.scrollY > 48);

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ identity: AuthIdentity | null }> : { identity: null })
      .then(({ identity }) => {
        if (cancelled || !identity) return;
        setAuthIdentity(identity);
        syncAuthenticatedUser(identity);
      });
    return () => { cancelled = true; };
  }, [syncAuthenticatedUser]);

  async function signOut() {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/");
  }

  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0];
  const roleUsers = users.filter((user) => activeRole === "admin"
    ? user.roleBadges.includes("admin")
    : user.roleBadges.some((role) => role !== "admin"));
  const contextLink = activeRole === "admin"
    ? { href: "/admin", label: "Admin" }
    : { href: "/feed", label: "Creator feed" };

  return (
    <header
      data-header-compact={compact ? "true" : "false"}
      className={`sticky top-0 z-[70] border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ${compact ? "border-line/70 bg-paper/95 shadow-lg shadow-black/10" : "border-line bg-paper/90"}`}
    >
      <HydrateStore />
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 transition-[height] duration-300 ${compact ? "h-12" : "h-16"}`}>
        <Link
          href="/"
          aria-label="Chaplin home"
          data-header-logo
          className={`relative flex items-center shrink-0 transition-[width,height] duration-300 ${compact ? "h-9 w-9" : "h-11 w-[8.75rem]"}`}
        >
          <span
            data-header-wordmark
            className={`absolute inset-y-0 left-0 flex items-center transition-all duration-300 ${compact ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
          >
            <Image
              src="/brand/chaplin-logo-transparent.png"
              alt="Chaplin"
              data-header-full-logo
              width={1826}
              height={585}
              priority
              quality={90}
              sizes="140px"
              className="h-11 w-auto max-w-[8.75rem] object-contain object-left"
            />
          </span>
          <Image
            src="/brand/chaplin-mark.png"
            alt=""
            aria-hidden="true"
            data-header-compact-mark
            width={40}
            height={40}
            priority
            className={`absolute inset-0 h-9 w-9 object-contain transition-all duration-300 ${compact ? "scale-100 rotate-0 opacity-100" : "pointer-events-none scale-75 -rotate-6 opacity-0"}`}
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href={contextLink.href} className={`hidden sm:block text-[10px] uppercase tracking-wider text-grey hover:text-accent transition-all duration-200 ${compact ? "pointer-events-none max-w-0 -translate-y-1 overflow-hidden opacity-0" : "max-w-28 translate-y-0 opacity-100"}`}>
            {contextLink.label}
          </Link>
          {!authIdentity && <Link href="/auth" className={`text-[10px] font-semibold uppercase tracking-wider text-accent transition-all duration-200 ${compact ? "hidden" : ""}`}>Sign in</Link>}
          <div className="relative">
            <button
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label="Switch demo login and role"
              className={`flex items-center rounded-full border py-1 transition-all duration-300 ${compact ? "gap-0 px-1" : "gap-2 px-1.5"} ${open ? "border-accent bg-white/[0.06]" : "border-line hover:border-accent"}`}
            >
              {currentUser && (
                <span className="accent-ring">
                  <Avatar hue={currentUser.avatarHue} label={currentUser.avatarInitial} src={currentUser.imageUrl} size={32} />
                </span>
              )}
              <span className={`text-left overflow-hidden transition-all duration-300 ${compact ? "max-w-0 pr-0 opacity-0" : "max-w-32 pr-2 opacity-100 sm:max-w-44"}`}>
                <span className="block text-xs sm:text-sm leading-tight font-medium truncate">{currentUser?.name}</span>
                <span className="block leading-tight text-[9px] sm:text-[10px] text-accent uppercase tracking-wide truncate">
                  {ROLE_META[activeRole].label}
                </span>
              </span>
            </button>

            {open && (
              <div className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[24rem] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-line bg-paper-dim shadow-2xl p-3 z-[90] ${compact ? "top-[3.25rem]" : "top-[4.25rem]"}`}>
                <div className="flex items-start justify-between gap-3 px-1 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">{authIdentity ? "Signed-in account" : "Quick view switch"}</p>
                    <p className="text-xs text-grey mt-1">{authIdentity ? `${authIdentity.email} · ${authIdentity.role}` : "Jump between complete role-specific demo sessions."}</p>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-grey hover:text-ink text-lg leading-none" aria-label="Close role switcher">×</button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 mb-4">
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
                  {authIdentity ? <button type="button" onClick={() => void signOut()} className="text-xs font-semibold text-grey hover:text-accent">Sign out</button> : <Link href="/auth" onClick={() => setOpen(false)} className="text-xs font-semibold text-accent">Sign in or create account</Link>}
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
