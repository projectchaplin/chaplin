"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { CHAPLIN_VERSION_LABEL } from "@/lib/version";

export default function SiteFooter() {
  const pathname = usePathname();
  // The home gallery is a locked 100dvh app screen — no footer below it.
  if (pathname === "/" || pathname === "/super-admin") return null;

  return (
    <footer
      data-site-footer
      className="relative z-10 border-t border-line pb-24 lg:pb-0 lg:pl-[5.5rem]"
    >
      <div className="app-width flex min-w-0 flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-grey sm:flex-row">
        <Image
          src="/brand/chaplin-logo-transparent.png"
          alt="Chaplin"
          width={1826}
          height={585}
          quality={90}
          sizes="112px"
          className="h-8 w-auto max-w-28 object-contain"
        />
        <span className="min-w-0 text-center sm:text-right">A casting marketplace for AI actors. Every actor, every audience. · {CHAPLIN_VERSION_LABEL}</span>
      </div>
    </footer>
  );
}
