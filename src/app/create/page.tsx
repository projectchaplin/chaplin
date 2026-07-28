"use client";

import Link from "next/link";
import { CHARACTER_CREATION_CREDITS, PUNCH_15S_CREDITS } from "@/lib/credits";

const rolePaths = {
  creator: [
    { href: "/characters/new", runtime: `${CHARACTER_CREATION_CREDITS} CR`, title: "Create an actor", copy: "Build the identity, voice, movement, sound, and production bible." },
    { href: "/videos/new", runtime: "VIDEO", title: "Create a typed video", copy: "Choose actor, product, UGC, hero, or brand-spot grammar before shots are planned." },
    { href: "/studio/write?format=spark", runtime: "5 SEC", title: "Create a Spark", copy: "One private audition shot. It proves a casting choice and never enters the feed." },
    { href: "/studio/write?format=punch", runtime: `${PUNCH_15S_CREDITS} CR`, title: "Create a 15-second Punch", copy: "Three approved shots: hook, pressure, and a memorable personality choice." },
    { href: "/studio/write?format=episode", runtime: "60 SEC", title: "Create an Episode", copy: "Twelve approved shots ending on a situation-changing cliffhanger." },
  ],
};

export default function CreatePage() {
  const paths = rolePaths.creator;

  return (
    <main className="app-width px-6 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">creator create desk</p>
      <h1 className="marquee-title mt-3 text-5xl sm:text-7xl">
        BUILD A PERFORMER. MAKE THE PROOF.
      </h1>
      <p className="mt-4 max-w-2xl text-grey">
        The output is chosen before the prompt. Runtime, shot count, approvals, destination, and who can publish are fixed from the start.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-accent">
        Your 100 welcome credits cover one actor and one 15-second Punch.
      </p>
      <div className="mt-10 border-t border-line">
        {paths.map((item, index) => (
          <Link key={item.href} href={item.href} className="group grid gap-3 border-b border-line py-6 transition-colors hover:border-accent sm:grid-cols-[90px_1fr_1fr] sm:items-center">
            <span className="font-mono text-xl text-accent">{item.runtime}</span>
            <h2 className="reel-title text-3xl group-hover:text-accent-light">{item.title}</h2>
            <p className="text-sm leading-6 text-grey">{item.copy}</p>
            <span className="hidden text-right text-accent sm:block sm:col-start-3">Open →</span>
            <span className="font-mono text-[9px] text-grey sm:col-start-1 sm:row-start-1">{String(index + 1).padStart(2, "0")}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
