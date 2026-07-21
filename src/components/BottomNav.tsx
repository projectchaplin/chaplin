"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconMask, IconFilm, IconBriefcase, IconReceipt, IconTrophy } from "@/components/Icons";
import { useChaplinStore } from "@/lib/store";
import type { AppRole } from "@/lib/types";

const TABS: Record<AppRole, Array<{ href: string; label: string; Icon: typeof IconHome }>> = {
  maker: [
    { href: "/", label: "Home", Icon: IconHome },
    { href: "/characters", label: "Actors", Icon: IconMask },
    { href: "/studio", label: "Maker", Icon: IconBriefcase },
    { href: "/stories", label: "Stories", Icon: IconFilm },
    { href: "/ledger", label: "Earnings", Icon: IconTrophy },
  ],
  caster: [
    { href: "/", label: "Home", Icon: IconHome },
    { href: "/characters", label: "Cast", Icon: IconMask },
    { href: "/stories", label: "Stories", Icon: IconFilm },
    { href: "/studio/write", label: "Write", Icon: IconBriefcase },
    { href: "/ledger", label: "Leaders", Icon: IconTrophy },
  ],
  brand: [
    { href: "/", label: "Home", Icon: IconHome },
    { href: "/characters", label: "Talent", Icon: IconMask },
    { href: "/studio/write", label: "Create", Icon: IconFilm },
    { href: "/stories", label: "Campaigns", Icon: IconBriefcase },
    { href: "/ledger", label: "Licensing", Icon: IconReceipt },
  ],
  admin: [
    { href: "/admin", label: "Admin", Icon: IconBriefcase },
    { href: "/admin/logs", label: "Logs", Icon: IconReceipt },
    { href: "/characters", label: "Actors", Icon: IconMask },
    { href: "/stories", label: "Stories", Icon: IconFilm },
    { href: "/studio", label: "Studio", Icon: IconHome },
  ],
};

export default function BottomNav() {
  const pathname = usePathname();
  const activeRole = useChaplinStore((state) => state.activeRole);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-paper/80 backdrop-blur-xl">
      <div className="max-w-md mx-auto flex items-stretch justify-around px-2">
        {TABS[activeRole].map(({ href, label, Icon }) => {
          const active = href === "/" || href === "/admin"
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 px-3 min-w-16"
            >
              <span
                className="flex items-center justify-center w-9 h-9 rounded-full transition-all"
                style={
                  active
                    ? { background: "var(--accent)" }
                    : { background: "transparent" }
                }
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-white" : "text-grey"}`}
                />
              </span>
              <span
                className={`text-[10px] leading-none ${
                  active ? "accent-text font-semibold" : "text-grey"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
