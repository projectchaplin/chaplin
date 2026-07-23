import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodePipelineBoard from "@/components/EpisodePipelineBoard";
import { getSeriesDetail } from "@/lib/server/series";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getSeriesDetail(id);
  if (!series) notFound();
  const pilot = series.episodes[0];
  const readyShots = pilot?.shots.filter((shot) => shot.status === "ready").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/series" className="text-xs text-grey hover:text-accent">← Production slate</Link>
      <header className="mt-5 border-b border-line pb-8">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em]"><span className="rounded-full border border-accent px-2 py-1 text-accent">{series.status}</span><span className="text-grey">{series.genre} · {series.primaryLanguage}{series.secondaryLanguage ? ` + ${series.secondaryLanguage}` : ""}</span></div>
        <h1 className="reel-title mt-3 text-4xl sm:text-6xl">{series.title}</h1>
        <p className="mt-3 max-w-3xl text-base text-grey">{series.logline}</p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="poster-card rounded-lg p-5 lg:col-span-2"><p className="text-[10px] uppercase tracking-[0.18em] text-accent">Series premise</p><p className="mt-3 text-sm leading-6">{series.premise}</p></section>
        <section className="poster-card rounded-lg p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-accent">Cast lock</p><div className="mt-3 space-y-3">{series.cast.map((member) => <div key={member.characterId}><p className="font-semibold">{member.characterName}</p><p className="text-xs text-grey">{member.roleName} · production bible locked</p></div>)}</div></section>
      </div>

      <section className="poster-card mt-5 rounded-lg p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Recurring story engine</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[["Audience promise", series.storyEngine.audiencePromise], ["Central conflict", series.storyEngine.centralConflict], ["Season question", series.storyEngine.seasonQuestion], ["Escalation", series.storyEngine.escalationRule], ["Cliffhanger grammar", series.storyEngine.cliffhangerRule], ["Tone", series.storyEngine.tone]].map(([label, value]) => <div key={label}><p className="text-[10px] uppercase text-grey">{label}</p><p className="mt-1 text-sm">{value}</p></div>)}
        </div>
      </section>

      {pilot && <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-accent">Episode {pilot.episodeNumber}</p><h2 className="reel-title text-3xl">{pilot.title}</h2><p className="mt-1 text-sm text-grey">{pilot.logline}</p></div><div className="text-right"><p className="text-xl font-semibold">{readyShots}/12</p><p className="text-[10px] uppercase text-grey">shots ready</p></div></div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="rounded-md border border-line p-3"><p className="text-[9px] uppercase text-grey">Opening hook</p><p className="mt-1 text-xs">{pilot.openingHook}</p></div><div className="rounded-md border border-line p-3"><p className="text-[9px] uppercase text-grey">Objective</p><p className="mt-1 text-xs">{pilot.episodeObjective}</p></div><div className="rounded-md border border-accent/50 bg-accent/5 p-3"><p className="text-[9px] uppercase text-accent">Cliffhanger</p><p className="mt-1 text-xs">{pilot.cliffhanger}</p></div></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{pilot.shots.map((shot) => <article key={shot.id} className="poster-card rounded-md p-4"><div className="flex justify-between text-[10px] uppercase"><span className="text-accent">Shot {String(shot.shotNumber).padStart(2, "0")} · {(shot.shotNumber - 1) * 5}–{shot.shotNumber * 5}s</span><span className="text-grey">{shot.status}</span></div><h3 className="mt-2 font-semibold">{shot.beat}</h3><p className="mt-2 text-xs leading-5 text-grey">{shot.visualAction}</p><div className="mt-3 border-t border-line pt-3 text-[10px] text-grey"><p><span className="text-ink">Camera:</span> {shot.cameraDirection}</p><p className="mt-1"><span className="text-ink">Light:</span> {shot.lightingDirection}</p>{shot.dialogue && <p className="mt-1 text-accent-light">{shot.dialogue}</p>}</div></article>)}</div>
        <EpisodePipelineBoard episodeId={pilot.id} shots={pilot.shots.map((shot) => ({ id: shot.id, shotNumber: shot.shotNumber }))} />
      </section>}
    </main>
  );
}
