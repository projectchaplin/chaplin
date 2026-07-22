import Link from "next/link";

const paths = [
  { href: "/feed", eyebrow: "Post", title: "Start a conversation", copy: "Share one thought, image, or video and invite other creators into the thread." },
  { href: "/characters/new", eyebrow: "Identity", title: "Create a new persona", copy: "Develop the face, voice, performance rules, signature sound, and visual continuity." },
  { href: "/series/new", eyebrow: "Series", title: "Build a 60-second pilot", copy: "Lock the cast, recurring engine, twelve five-second shots, and cliffhanger." },
  { href: "/studio/write", eyebrow: "Scene", title: "Write something shootable", copy: "Turn a brief into visible action, camera direction, dialogue, and a production draft." },
];

export default function CreatePage() {
  return <main className="mx-auto w-full max-w-5xl px-6 py-12"><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Create on Chaplin</p><h1 className="marquee-title mt-3 text-5xl sm:text-7xl">WHAT ARE YOU MAKING?</h1><p className="mt-4 max-w-2xl text-grey">The same creation paths are available to every creator. Start socially, build an identity, plan a series, or write a scene.</p><div className="mt-10 grid gap-4 sm:grid-cols-2">{paths.map((item) => <Link key={item.href} href={item.href} className="poster-card group rounded-xl p-6"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{item.eyebrow}</span><h2 className="reel-title mt-5 text-3xl group-hover:text-accent-light">{item.title}</h2><p className="mt-2 text-sm leading-6 text-grey">{item.copy}</p><span className="mt-8 block text-sm">Open →</span></Link>)}</div></main>;
}

