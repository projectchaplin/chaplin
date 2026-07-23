"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MEDIA_OUTPUT_DEFINITIONS } from "@/lib/media-output-definitions";
import type { MediaOutputType } from "@/lib/media-pipeline-types";

type TimedOutput = {
  type: MediaOutputType;
  label: string;
  duration: number;
  shots: number;
  note: string;
  audience: string;
};

const outputs: TimedOutput[] = [
  { type: "spark", label: "Spark", duration: 5, shots: 1, note: "One unmistakable performance beat.", audience: "Private casting proof" },
  { type: "punch", label: "Punch", duration: 15, shots: 3, note: "Hook, pressure, memorable choice.", audience: "Public personality proof" },
  { type: "spot", label: "Spot", duration: 30, shots: 6, note: "A managed commercial performance.", audience: "Brand delivery" },
  { type: "episode", label: "Episode", duration: 60, shots: 12, note: "Twelve decisions ending in a cliffhanger.", audience: "Serialized microdrama" },
];

const providerTone: Record<string, string> = {
  chaplin: "text-accent-light border-accent-light/30 bg-accent-light/5",
  seedream: "text-fuchsia-200 border-fuchsia-300/30 bg-fuchsia-300/5",
  seedance: "text-cyan-200 border-cyan-300/30 bg-cyan-300/5",
  elevenlabs: "text-amber-200 border-amber-300/30 bg-amber-300/5",
  ffmpeg: "text-violet-200 border-violet-300/30 bg-violet-300/5",
  human: "text-white border-white/30 bg-white/5",
};

function ShotCells({ count, active }: { count: number; active: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`h-9 min-w-2 flex-1 overflow-hidden rounded-[3px] border ${
            active
              ? "pipeline-shot-cell border-accent/40 bg-gradient-to-r from-accent/70 to-accent-secondary/65"
              : "border-white/10 bg-white/5"
          }`}
        />
      ))}
    </span>
  );
}

function FlowArrow({ label }: { label?: string }) {
  return (
    <div className="flex min-w-10 flex-col items-center justify-center gap-1 text-center">
      {label && <span className="text-[8px] uppercase tracking-[0.16em] text-grey">{label}</span>}
      <span className="flex w-full items-center">
        <span className="pipeline-flow-line h-px flex-1" />
        <span className="-ml-px h-2 w-2 rotate-45 border-r border-t border-accent-secondary" />
      </span>
    </div>
  );
}

export default function MediaPipelineExperience() {
  const [selectedType, setSelectedType] = useState<MediaOutputType>("episode");
  const selected = MEDIA_OUTPUT_DEFINITIONS[selectedType];
  const timed = useMemo(() => outputs.find((output) => output.type === selectedType), [selectedType]);

  return (
    <main className="relative isolate overflow-hidden bg-[#080b05] text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(circle_at_20%_0%,rgba(242,78,112,0.17),transparent_34%),radial-gradient(circle_at_80%_8%,rgba(7,210,190,0.15),transparent_30%)]" />

      <section className="mx-auto min-h-[86vh] w-full max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/studio" className="text-xs text-grey transition-colors hover:text-accent">← My Studio</Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-grey">Pre-production map</span>
        </div>

        <header className="mt-14 max-w-5xl sm:mt-20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">Before the first prompt</p>
          <h1 className="reel-title mt-4 text-[clamp(3.5rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.055em]">
            See the whole film
            <span className="block bg-gradient-to-r from-accent via-[#ff9aae] to-accent-secondary bg-clip-text text-transparent">
              before you make it.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-sm leading-6 text-grey sm:text-base">
            Chaplin begins with the output—not a blank prompt. Choose how long the audience watches,
            then see every image, motion, voice, sound, approval, and assembly step required to deliver it.
          </p>
        </header>

        <div className="mt-16 sm:mt-24">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.24em] text-grey">Choose the finished runtime</p>
              <p className="mt-1 text-sm text-ink">One production atom. Four storytelling scales.</p>
            </div>
            <p className="hidden text-right text-[10px] text-grey sm:block">Select a runtime to trace its workflow</p>
          </div>
          <div className="relative grid grid-cols-4 gap-2 border-b border-white/10 pb-8">
            <div className="pipeline-flow-line pointer-events-none absolute bottom-[31px] left-0 right-0 h-px" />
            {outputs.map((output) => {
              const active = output.type === selectedType;
              return (
                <button
                  key={output.type}
                  type="button"
                  onClick={() => setSelectedType(output.type)}
                  className="group relative flex min-w-0 flex-col items-start pb-5 text-left"
                  aria-pressed={active}
                >
                  <span className={`font-mono text-[clamp(2rem,6vw,5.5rem)] leading-none tracking-[-0.08em] transition-colors ${active ? "text-ink" : "text-white/20 group-hover:text-white/45"}`}>{output.duration}</span>
                  <span className={`mt-1 text-[9px] uppercase tracking-[0.18em] sm:text-[11px] ${active ? "text-accent" : "text-grey"}`}>
                    sec · {output.label}
                  </span>
                  <span className={`absolute bottom-[-5px] left-0 h-2.5 w-2.5 rounded-full border-2 border-[#080b05] transition-all ${active ? "scale-150 bg-accent shadow-[0_0_22px_rgba(242,78,112,0.9)]" : "bg-white/30"}`} />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-accent-secondary">The production atom</p>
              <h2 className="reel-title mt-3 text-5xl leading-none sm:text-7xl">One approved shot.</h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-grey">
                Every Chaplin video is made from exact five-second units. Image and audio travel on
                separate paths, then merge only after the performance is locked.
              </p>
            </div>
            <div className="flex items-end justify-between border-b border-white/10 pb-3">
              {["00:00", "00:01", "00:02", "00:03", "00:04", "00:05"].map((time, index) => (
                <span key={time} className={`font-mono text-[9px] ${index === 5 ? "text-accent" : "text-grey"}`}>{time}</span>
              ))}
            </div>
          </div>

          <div className="mt-12 overflow-x-auto pb-4">
            <div className="grid min-w-[1050px] grid-cols-[150px_54px_190px_54px_260px_54px_170px_54px_150px] items-center">
              <div className="relative">
                <span className="absolute -top-7 text-[8px] uppercase tracking-[0.2em] text-grey">Story intent</span>
                <p className="reel-title text-3xl">Plan lock</p>
                <p className="mt-2 text-[10px] leading-4 text-grey">Action · camera · light · continuity</p>
              </div>
              <FlowArrow />
              <div className="relative">
                <span className="absolute -top-7 text-[8px] uppercase tracking-[0.2em] text-fuchsia-200">Seedream</span>
                <div className="aspect-video overflow-hidden rounded-sm border border-fuchsia-300/30 bg-[radial-gradient(circle_at_50%_30%,rgba(242,78,112,0.45),transparent_18%),linear-gradient(145deg,#2d1523,#11170e_55%,#07241e)]">
                  <div className="flex h-full items-end p-3"><span className="text-[9px] uppercase tracking-[0.18em] text-white/70">Exact first frame</span></div>
                </div>
                <p className="mt-2 text-[10px] text-grey">Identity · wardrobe · blocking</p>
              </div>
              <FlowArrow label="Approve" />
              <div className="relative grid gap-3">
                <span className="absolute -top-7 text-[8px] uppercase tracking-[0.2em] text-grey">Parallel production</span>
                <div className="flex items-center gap-3 border-b border-cyan-300/20 pb-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
                  <div><p className="text-xs font-semibold">Silent motion plate</p><p className="text-[9px] text-cyan-200">Seedance · image to video</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {[4, 9, 14, 7, 11, 5].map((height, index) => <span key={index} className="w-0.5 bg-amber-300" style={{ height }} />)}
                  </div>
                  <div><p className="text-xs font-semibold">Audio stems</p><p className="text-[9px] text-amber-200">Voice · SFX · room tone · theme</p></div>
                </div>
              </div>
              <FlowArrow label="Merge" />
              <div className="relative text-center">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-[0.2em] text-violet-200">FFmpeg</span>
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-violet-300/30 bg-violet-300/5 shadow-[0_0_60px_rgba(196,181,253,0.08)]">
                  <div><p className="reel-title text-2xl">Mix</p><p className="text-[8px] uppercase tracking-wide text-grey">and mux</p></div>
                </div>
              </div>
              <FlowArrow label="QC" />
              <div className="rounded-sm border border-accent-secondary/40 bg-gradient-to-br from-accent-secondary/15 to-accent/10 p-4 shadow-[0_0_50px_rgba(7,210,190,0.08)]">
                <p className="text-[8px] uppercase tracking-[0.2em] text-accent-secondary">Approved unit</p>
                <p className="reel-title mt-2 text-3xl">5 sec</p>
                <p className="mt-1 text-[9px] text-grey">Picture + final mix + manifest</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.26em] text-accent">The output river</p>
          <h2 className="reel-title mt-3 text-5xl leading-none sm:text-7xl">Shots become stories.</h2>
          <p className="mt-5 text-sm leading-6 text-grey">The length changes. The quality bar does not. Every segment is one approved five-second shot package.</p>
        </div>

        <div className="mt-14 space-y-3">
          {outputs.map((output) => {
            const active = output.type === selectedType;
            return (
              <button
                type="button"
                key={output.type}
                onClick={() => setSelectedType(output.type)}
                className={`group grid w-full grid-cols-[82px_1fr_54px] items-center gap-3 border-y py-4 text-left transition-all sm:grid-cols-[150px_1fr_90px] ${active ? "border-accent/50 bg-accent/[0.035]" : "border-white/5 hover:border-white/20"}`}
              >
                <span>
                  <span className={`reel-title block text-2xl sm:text-4xl ${active ? "text-ink" : "text-white/55"}`}>{output.label}</span>
                  <span className="mt-1 hidden text-[9px] uppercase tracking-wide text-grey sm:block">{output.audience}</span>
                </span>
                <span className="flex items-center gap-2">
                  <ShotCells count={output.shots} active={active} />
                  <span className="hidden text-[9px] text-grey lg:block">{output.shots} shot{output.shots === 1 ? "" : "s"}</span>
                </span>
                <span className={`text-right font-mono text-xl sm:text-3xl ${active ? "text-accent" : "text-white/30"}`}>{output.duration}s</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0b1008]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="text-[10px] uppercase tracking-[0.26em] text-accent-secondary">Selected workflow</p>
            <h2 className="reel-title mt-3 text-6xl sm:text-8xl">{selected.label}</h2>
            {timed && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-2xl text-accent">{timed.duration} seconds</span>
                <span className="text-grey">·</span>
                <span className="text-xs uppercase tracking-wide text-grey">{timed.shots} × 5-second shots</span>
              </div>
            )}
            <p className="mt-5 max-w-md text-sm leading-6 text-grey">{selected.description}</p>
            {timed && <p className="mt-3 max-w-md text-xs leading-5 text-accent-light">{timed.note}</p>}
            <div className="mt-8 flex flex-wrap gap-2">
              {outputs.map((output) => (
                <button
                  key={output.type}
                  type="button"
                  onClick={() => setSelectedType(output.type)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-wide ${output.type === selectedType ? "border-accent bg-accent text-white" : "border-white/10 text-grey hover:border-white/30"}`}
                >
                  {output.label}
                </button>
              ))}
            </div>
          </div>

          <ol className="relative ml-3 border-l border-white/10 sm:ml-8">
            {selected.steps.map((step, index) => {
              const review = Boolean(step.requiresReview);
              return (
                <li key={step.key} className="relative pb-12 pl-9 last:pb-0 sm:pl-14">
                  <span className={`absolute left-0 top-1 flex -translate-x-1/2 items-center justify-center border ${review ? "h-7 w-7 rotate-45 border-white/45 bg-[#0b1008]" : "h-5 w-5 rounded-full border-accent-secondary/60 bg-[#0b1008]"}`}>
                    {!review && <span className="h-1.5 w-1.5 rounded-full bg-accent-secondary shadow-[0_0_12px_rgba(7,210,190,0.9)]" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] text-grey">{String(index + 1).padStart(2, "0")}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.14em] ${providerTone[step.executor] ?? providerTone.chaplin}`}>{step.executor}</span>
                    {review && <span className="text-[8px] uppercase tracking-[0.16em] text-white/70">human gate</span>}
                  </div>
                  <h3 className="reel-title mt-2 text-3xl sm:text-4xl">{step.label}</h3>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-grey">
                    {review
                      ? "Nothing downstream moves until this result is explicitly approved. Rejected attempts remain in the production history."
                      : step.executor === "chaplin"
                        ? "Chaplin resolves the story, identity, continuity, rights, or delivery contract required by the next stage."
                        : `The ${step.executor} executor returns a versioned asset and records its inputs, model, cost, and attempt in the manifest.`}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <div className="flex flex-col gap-8 border-t border-white/10 pt-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-accent">Only then do we prompt.</p>
            <h2 className="reel-title mt-3 max-w-3xl text-4xl leading-tight sm:text-6xl">
              The prompt is one instruction inside a production plan—not the product.
            </h2>
          </div>
          <Link href="/series/new" className="group inline-flex shrink-0 items-center gap-5 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white">
            Plan a 60s pilot <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
