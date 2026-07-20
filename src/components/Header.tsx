"use client";

import Link from "next/link";
import { useState } from "react";
import { useChaplinStore } from "@/lib/store";
import Avatar from "@/components/Avatar";
import HydrateStore from "@/components/HydrateStore";

export default function Header() {
  const users = useChaplinStore((s) => s.users);
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const setCurrentUser = useChaplinStore((s) => s.setCurrentUser);
  const [open, setOpen] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];

  return (
    <header className="sticky top-0 z-50 bg-paper/80 backdrop-blur-xl border-b border-line">
      <HydrateStore />
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="accent-rule w-6 rounded-full" />
          <span className="marquee-title text-2xl leading-none tracking-widest">
            CHAPLIN
          </span>
        </Link>

        <div className="relative shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full pl-1 pr-1 py-1"
          >
            {currentUser && (
              <span className="accent-ring">
                <Avatar
                  hue={currentUser.avatarHue}
                  label={currentUser.avatarInitial}
                  src={currentUser.imageUrl}
                  size={34}
                />
              </span>
            )}
            <span className="text-sm hidden sm:block text-left">
              <span className="block leading-tight font-medium">{currentUser?.name}</span>
              <span className="block leading-tight text-[10px] text-grey uppercase tracking-wide">
                acting as
              </span>
            </span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-64 poster-card rounded-md shadow-lg p-2 z-50">
              <p className="text-[11px] uppercase tracking-wide text-grey px-2 py-1">
                Switch who you&apos;re acting as
              </p>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-sm text-left hover:bg-white/8 ${
                    u.id === currentUserId ? "bg-white/8" : ""
                  }`}
                >
                  <Avatar hue={u.avatarHue} label={u.avatarInitial} src={u.imageUrl} size={28} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{u.name}</span>
                    <span className="block text-[11px] text-grey">
                      {u.roleBadges.join(" · ")}
                    </span>
                  </span>
                  {u.id === currentUserId && <span className="text-accent text-xs">●</span>}
                </button>
              ))}
              <div className="border-t border-line mt-2 pt-2 px-2">
                <Link
                  href="/characters/new"
                  onClick={() => setOpen(false)}
                  className="text-xs text-accent hover:underline"
                >
                  + Build a new character
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
