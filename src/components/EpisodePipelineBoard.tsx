"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MediaPipelineRun } from "@/lib/media-pipeline-types";

type ShotSummary = {
  id: string;
  shotNumber: number;
};

function statusTone(status: string) {
  if (["approved", "succeeded", "ready"].includes(status)) return "border-emerald-500/50 text-emerald-300";
  if (["failed", "cancelled"].includes(status)) return "border-red-500/50 text-red-300";
  if (status === "needs_review") return "border-amber-400/50 text-amber-200";
  if (["running", "queued"].includes(status)) return "border-accent-secondary/50 text-accent-secondary";
  return "border-line text-grey";
}

export default function EpisodePipelineBoard({
  episodeId,
  shots,
}: {
  episodeId: string;
  shots: ShotSummary[];
}) {
  const [run, setRun] = useState<MediaPipelineRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/pipeline?scopeType=episode&scopeId=${encodeURIComponent(episodeId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load episode pipeline.");
        if (active) setRun(data.runs?.[0] ?? null);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load episode pipeline.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [episodeId]);

  async function initialize() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: "episode",
          scopeId: episodeId,
          outputType: "episode",
          idempotencyKey: `episode:${episodeId}:master:v1`,
          spec: {
            durationSeconds: 60,
            aspectRatio: "9:16",
            shotIds: shots.map((shot) => shot.id),
            shotCount: shots.length,
            delivery: {
              video: "H.264 1080x1920",
              audio: "AAC 48kHz, -16 LUFS, -1 dBTP",
              captions: ["WebVTT", "SRT"],
            },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not initialize production.");
      setRun(data.run);
      setMessage("The episode now has a durable production run and manifest.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not initialize production.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="poster-card mt-5 rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Final-output pipeline</p>
          <h3 className="reel-title mt-1 text-2xl">From twelve shot packages to one master</h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-grey">
            Identity frame, silent motion, locked dialogue, SFX, room tone, shot mix, QC, approval,
            ordered assembly, captions, and publish delivery are separate durable gates.
          </p>
        </div>
        <Link href="/studio/pipelines" className="rounded-full border border-line px-3 py-2 text-xs text-grey hover:border-accent hover:text-accent">
          View every output
        </Link>
      </div>

      {loading ? (
        <p className="mt-5 text-xs text-grey">Loading production state...</p>
      ) : !run ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-4">
          <div>
            <p className="text-sm font-semibold">No episode run yet</p>
            <p className="mt-1 text-xs text-grey">Initialize the versioned 9:16, 60-second delivery contract for these {shots.length} shots.</p>
          </div>
          <button
            type="button"
            onClick={initialize}
            disabled={busy || shots.length !== 12}
            className="rounded-sm bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Initializing..." : "Initialize production"}
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${statusTone(run.status)}`}>{run.status}</span>
            <span className="text-xs text-grey">Run {run.id.slice(0, 8)} · current gate {run.currentStep ?? "complete"}</span>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {run.steps.map((step) => (
              <li key={step.id} className="rounded-md border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] uppercase tracking-wide text-grey">{String(step.position).padStart(2, "0")} · {step.executor}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[8px] uppercase ${statusTone(step.status)}`}>{step.status}</span>
                </div>
                <p className="mt-2 text-xs font-semibold">{step.label}</p>
                {step.requiresReview && <p className="mt-1 text-[9px] uppercase text-amber-200">Approval gate</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {message && <p className="mt-3 text-xs text-accent-light">{message}</p>}
    </section>
  );
}
