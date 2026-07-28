"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { CHAPLIN_VERSION_LABEL } from "@/lib/version";

export default function SiteFooter() {
  const pathname = usePathname();
  // The home gallery is a locked 100dvh app screen — no footer below it.
  if (pathname === "/" || pathname === "/super-admin") return null;

  return (
    <footer className="border-t border-line relative z-10 pb-24">
      <div className="app-width px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-grey">
        <Image
          src="/brand/chaplin-logo-transparent.png"
          alt="Chaplin"
          width={1826}
          height={585}
          quality={90}
          sizes="112px"
          className="h-8 w-auto max-w-28 object-contain"
        />
        <span>A casting marketplace for AI actors. Every actor, every audience. · {CHAPLIN_VERSION_LABEL}</span>
      </div>
    </footer>
  );
}
