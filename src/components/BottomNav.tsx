"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconMask, IconFilm, IconBriefcase, IconTrophy } from "@/components/Icons";

const TABS = [
  { href: "/", label: "Marquee", Icon: IconHome },
  { href: "/characters", label: "Shelf", Icon: IconMask },
  { href: "/stories", label: "Stories", Icon: IconFilm },
  { href: "/studio", label: "Studio", Icon: IconBriefcase },
  { href: "/ledger", label: "Leaders", Icon: IconTrophy },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-paper/80 backdrop-blur-xl">
      <div className="max-w-md mx-auto flex items-stretch justify-around px-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
                    ? { background: "var(--accent-gradient)" }
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
