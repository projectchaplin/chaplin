"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import { useChaplinStore } from "@/lib/store";
import { castForStory, getStory } from "@/lib/selectors";
import {
  PRODUCTION_FORMATS,
  normalizeProductionFormat,
  productionShotCount,
} from "@/lib/production-formats";
import type { MediaPipelineRun, PipelineScope } from "@/lib/media-pipeline-types";

function stepTone(status: string) {
  if (status === "ready") return "border-accent-secondary text-accent-secondary";
  if (status === "succeeded" || status === "approved") return "border-emerald-400 text-emerald-300";
  if (status === "needs_review") return "border-amber-300 text-amber-200";
  if (status === "failed") return "border-red-400 text-red-300";
  return "border-white/10 text-grey";
}

export default function ProductionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const world = useChaplinStore((state) => state);
  const hydrated = useChaplinStore((state) => state.hydrated);
  const story = getStory(world, id);
  const cast = useMemo(
    () => story ? castForStory(world, story.id).map((item) => item.character) : [],
    [story, world],
  );
  const [run, setRun] = useState<MediaPipelineRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const contract = useMemo(() => {
    if (!story) return null;
    const format = normalizeProductionFormat(story.format);
    const definition = PRODUCTION_FORMATS[format];
    const duration = story.durationSeconds ?? definition.durationSeconds;
    const scopeType: PipelineScope = format === "spark" || format === "punch"
      ? "actor"
      : format === "episode"
        ? "episode"
        : "spot";
    const scopeId = scopeType === "actor" ? cast[0]?.id : story.id;
    return {
      format,
      definition,
      duration,
      shotCount: productionShotCount(format, duration),
      scopeType,
      scopeId,
    };
  }, [cast, story]);

  useEffect(() => {
    if (!contract?.scopeId) return;
    let active = true;
    fetch(`/api/pipeline?scopeType=${contract.scopeType}&scopeId=${encodeURIComponent(contract.scopeId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load production.");
        const matching = (data.runs as MediaPipelineRun[] | undefined)?.find(
          (candidate) => candidate.spec.productionId === story?.id
        );
        if (active) setRun(matching ?? null);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load production.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contract?.scopeId, contract?.scopeType, story?.id]);

  async function initializeProduction() {
    if (!story || !contract?.scopeId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: contract.scopeType,
          scopeId: contract.scopeId,
          outputType: contract.format,
          idempotencyKey: `production:${story.id}:${contract.format}:v1`,
          spec: {
            productionId: story.id,
            title: story.title,
            logline: story.logline,
            durationSeconds: contract.duration,
            shotCount: contract.shotCount,
            castCharacterIds: cast.map((character) => character.id),
            creativeDirection: story.creativeDirection ?? null,
            script: story.scenes.map((scene, index) => ({
              beat: index + 1,
              setting: scene.setting,
              objective: scene.objective ?? null,
              action: scene.action ?? null,
              lines: scene.lines.map((line) => ({ characterId: line.characterId, text: line.text })),
            })),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not initialize production.");
      setRun(data.run);
    } catch (initializeError) {
      setError(initializeError instanceof Error ? initializeError.message : "Could not initialize production.");
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-sm text-grey">Opening production…</main>;
  }

  if (!story || !contract) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-grey">This production draft is not available on this device.</p>
        <Link href="/studio" className="mt-4 inline-block text-accent">← My Studio</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/studio" className="text-xs text-grey hover:text-accent">← My Studio</Link>
        <span className="rounded-full border border-amber-300/30 px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-amber-200">
          Private production · not published
        </span>
      </div>

      <header className="mt-8 border-b border-line pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">{contract.definition.label} production</p>
            <h1 className="reel-title mt-2 text-4xl sm:text-6xl">{story.title}</h1>
            <p className="mt-4 text-sm leading-6 text-grey">{story.logline}</p>
          </div>
          <div className="flex items-end gap-5">
            <div><p className="font-mono text-4xl text-accent">{contract.duration}s</p><p className="text-[9px] uppercase text-grey">Runtime</p></div>
            <div><p className="font-mono text-4xl text-accent-secondary">{contract.shotCount}</p><p className="text-[9px] uppercase text-grey">Shot packages</p></div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 border-b border-line py-6 sm:grid-cols-3">
        {[
          ["01", "Script locked", `${story.scenes.length} playable beat${story.scenes.length === 1 ? "" : "s"}`],
          ["02", "Cast locked", `${cast.length} production identit${cast.length === 1 ? "y" : "ies"}`],
          ["03", run ? "Pipeline initialized" : "Pipeline waiting", run ? `Current gate: ${run.currentStep ?? "complete"}` : "No media has been generated"],
        ].map(([number, label, detail]) => (
          <div key={number} className="flex items-start gap-3">
            <span className="font-mono text-xs text-accent">{number}</span>
            <div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-[10px] text-grey">{detail}</p></div>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <aside>
          <p className="text-[10px] uppercase tracking-[0.2em] text-grey">Locked cast</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {cast.map((character) => (
              <Link key={character.id} href={`/characters/${character.id}`} className="flex items-center gap-2 rounded-full border border-line pr-3 hover:border-accent">
                <Avatar hue={character.avatarHue} label={character.name} src={character.imageUrl} size={34} />
                <span className="text-xs font-semibold">{character.name}</span>
              </Link>
            ))}
          </div>
          <div className="mt-8 border-l border-accent pl-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Output promise</p>
            <p className="mt-2 text-sm leading-6">{contract.definition.promise}</p>
            <p className="mt-2 text-xs text-grey">{contract.definition.structure}</p>
          </div>
        </aside>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[0.2em] text-grey">Production state</p><h2 className="reel-title mt-1 text-3xl">From script to approved output</h2></div>
            {!run && (
              <button
                type="button"
                onClick={initializeProduction}
                disabled={busy || (contract.scopeId ? loading : false) || !contract.scopeId}
                className="rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Initializing…" : "Initialize pipeline"}
              </button>
            )}
          </div>

          {!run ? (
            <div className="mt-5 rounded-lg border border-dashed border-line p-8 text-center">
              <p className="reel-title text-2xl">The script is ready. Production has not started.</p>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-grey">
                Initializing creates the durable reference-frame, motion, audio, mix, QC, approval, and delivery gates. It does not publish or charge a provider by itself.
              </p>
            </div>
          ) : (
            <ol className="relative mt-6 border-l border-line pl-7">
              {run.steps.map((step, index) => (
                <li key={step.id} className="relative pb-7 last:pb-0">
                  <span className={`absolute -left-[2.14rem] top-0 flex h-4 w-4 items-center justify-center rounded-full border bg-paper ${stepTone(step.status)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] text-grey">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-[9px] uppercase tracking-wide text-accent-secondary">{step.executor}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase ${stepTone(step.status)}`}>{step.status}</span>
                    {step.requiresReview && <span className="text-[8px] uppercase text-amber-200">human approval</span>}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{step.label}</h3>
                </li>
              ))}
            </ol>
          )}
          {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
        </section>
      </div>

      <section className="mt-10 border-t border-line pt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="reel-title text-3xl">Locked script</h2>
          <span className="text-[9px] uppercase tracking-wide text-grey">{story.scenes.length} beats · expands to {contract.shotCount} shots</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {story.scenes.map((scene, index) => (
            <article key={scene.id} className="border-t border-line pt-4">
              <p className="font-mono text-[9px] text-accent">Beat {String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 text-xs font-semibold uppercase tracking-wide">{scene.setting}</h3>
              {scene.objective && <p className="mt-2 text-xs text-grey">{scene.objective}</p>}
              {scene.action && <p className="mt-2 text-sm leading-5">{scene.action}</p>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
