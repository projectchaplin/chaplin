"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type {
  MediaPipelineRun,
  MediaPipelineStep,
  PipelineScope,
  PipelineStepAction,
} from "@/lib/media-pipeline-types";

function stepTone(status: string) {
  if (status === "ready") return "border-accent-secondary text-accent-secondary";
  if (status === "running") return "border-accent text-accent";
  if (status === "queued") return "border-accent-secondary/70 text-accent-secondary";
  if (status === "succeeded" || status === "approved") return "border-emerald-400 text-emerald-300";
  if (status === "needs_review") return "border-amber-300 text-amber-200";
  if (status === "failed") return "border-red-400 text-red-300";
  return "border-white/10 text-grey";
}

const LIVE_STEP_COPY: Record<string, string> = {
  "plan-lock": "Chaplin is checking the script, cast, duration, and shot requirements before generation begins.",
  "reference-frame": "Seedream is composing the actor, performance, camera, set, and motivated light into the first frame.",
  "reference-review": "The generated identity frame is ready for a human check of face, wardrobe, composition, and continuity.",
  "motion-plate": "Seedance is preserving the approved first frame while animating performance and camera movement.",
  dialogue: "ElevenLabs is performing the approved dialogue with the actor's locked voice identity.",
  sfx: "ElevenLabs is creating the scene's short physical sound effects.",
  "room-tone": "ElevenLabs is building the location's clean ambient room tone.",
  "shot-mix": "FFmpeg is aligning picture, dialogue, effects, and room tone into one playable shot.",
  "technical-qc": "Chaplin is checking duration, streams, sync, dimensions, and delivery readiness.",
  "creative-review": "The final shot is waiting for a human creative approval.",
};

const AUTOMATED_SHOT_STEPS = new Set([
  "motion-plate",
  "dialogue",
  "sfx",
  "room-tone",
  "shot-mix",
  "technical-qc",
  "creative-review",
]);

const OUTPUT_REQUIRED_STEPS = new Set([
  "shot-packages",
  "assembly",
  "captions",
  "mastering",
  "reference-frame",
  "motion-plate",
  "dialogue",
  "sfx",
  "room-tone",
  "shot-mix",
]);

function stepHasAttachedOutput(step: MediaPipelineStep) {
  return Boolean(
    step.outputAssetId
    || (typeof step.output.url === "string" && step.output.url.length > 0)
    || Object.keys(step.output).length > 0
  );
}

function liveStepCopy(step: MediaPipelineStep) {
  return LIVE_STEP_COPY[step.key] ?? `${step.executor} is working on ${step.label.toLowerCase()}.`;
}

function elapsedLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
  const [renderProgress, setRenderProgress] = useState("");
  const [renderFrameUrl, setRenderFrameUrl] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const referenceStep = run?.steps.find((step) => step.key === "reference-frame");
  const referenceImageUrl = typeof referenceStep?.output.url === "string"
    ? referenceStep.output.url
    : null;
  const finalVideoStep = run
    ? [...run.steps].reverse().find((step) => (
      ["mastering", "assembly", "shot-mix"].includes(step.key)
      && typeof step.output.url === "string"
    ))
    : undefined;
  const finalVideoUrl = typeof finalVideoStep?.output.url === "string"
    ? finalVideoStep.output.url
    : null;
  const motionPreviewStep = run
    ? [...run.steps].reverse().find((step) => (
      ["motion-plate", "shot-mix", "assembly", "mastering"].includes(step.key)
      && typeof step.output.url === "string"
    ))
    : undefined;
  const previewVideoUrl = busy && renderFrameUrl
    ? null
    : finalVideoUrl
      ?? (typeof motionPreviewStep?.output.url === "string" ? motionPreviewStep.output.url : null);
  const castPreviewImageUrl = cast[0]?.imageUrl
    ?? cast[0]?.galleryUrls?.[0]
    ?? cast[0]?.bannerUrl
    ?? null;
  const previewImageUrl = renderFrameUrl ?? referenceImageUrl ?? castPreviewImageUrl;
  const completedStepCount = run?.steps.filter((step) => {
    if (!["succeeded", "approved", "skipped"].includes(step.status)) return false;
    if (!OUTPUT_REQUIRED_STEPS.has(step.key)) return true;
    return stepHasAttachedOutput(step);
  }).length ?? 0;
  const pipelineProgress = run?.steps.length
    ? Math.round((completedStepCount / run.steps.length) * 100)
    : 0;
  const mediaProgress = finalVideoUrl
    ? 100
    : previewVideoUrl
      ? 75
      : referenceImageUrl
        ? 25
        : renderFrameUrl
          ? 15
          : 0;
  const autoStepRef = useRef("");
  const liveStep = run?.steps.find((step) => step.status === "running")
    ?? run?.steps.find((step) => step.status === "queued")
    ?? null;
  const failedStep = run?.steps.find((step) => step.status === "failed") ?? null;
  const reviewStep = run?.steps.find((step) => step.status === "needs_review") ?? null;
  const readyStep = run?.steps.find((step) => step.status === "ready") ?? null;
  const reviewHasNoMedia = reviewStep?.key === "creative-review" && !finalVideoUrl;
  const productionState = busy || liveStep
    ? {
        tone: "live",
        eyebrow: `Live now · ${(liveStep?.executor ?? "Chaplin").toUpperCase()}`,
        title: renderProgress || liveStep?.label || "Generating production media",
        detail: liveStep ? liveStepCopy(liveStep) : "The production canvas will update as each generated asset is attached.",
      }
    : error
      ? {
          tone: "failed",
          eyebrow: "Generation stopped",
          title: "The production needs attention",
          detail: error,
        }
      : failedStep
      ? {
          tone: "failed",
          eyebrow: `Stopped at step ${failedStep.position}`,
          title: failedStep.label,
          detail: failedStep.errorMessage || "This step failed. Review the error and retry it before the production can continue.",
        }
      : reviewHasNoMedia
        ? {
            tone: "failed",
            eyebrow: `Blocked before step ${reviewStep?.position ?? run?.steps.length ?? 0}`,
            title: "The preview was never rendered",
            detail: "The workflow reached approval without attaching any scene clips or master video. Generate the real preview before approving anything.",
          }
        : reviewStep
          ? {
              tone: "review",
              eyebrow: `Waiting for approval · step ${reviewStep.position}`,
              title: reviewStep.label,
              detail: "Nothing is running in the background. Review the generated media and approve or regenerate it to continue.",
            }
          : !referenceImageUrl && !previewVideoUrl
            ? {
                tone: "idle",
                eyebrow: "Not live · no media generated",
                title: "The first preview has not started",
                detail: "The production plan exists, but no image or video provider is currently running.",
              }
            : readyStep
              ? {
                  tone: "idle",
                  eyebrow: `Ready · step ${readyStep.position}`,
                  title: readyStep.label,
                  detail: "This step is ready but has not started. Use the action below to continue.",
                }
              : {
                  tone: "idle",
                  eyebrow: "Production paused",
                  title: "No generation is running",
                  detail: "The canvas is waiting for the next production action.",
                };
  const liveElapsedSeconds = liveStep
    ? Math.max(0, Math.floor((clock - Date.parse(run?.updatedAt ?? new Date().toISOString())) / 1000))
    : 0;

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

  useEffect(() => {
    if (!liveStep) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveStep, run?.updatedAt]);

  useEffect(() => {
    if (!liveStep || !contract?.scopeId || !story?.id) return;
    let active = true;
    const refresh = async () => {
      const response = await fetch(`/api/pipeline?scopeType=${contract.scopeType}&scopeId=${encodeURIComponent(contract.scopeId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { runs?: MediaPipelineRun[] };
      const matching = data.runs?.find((candidate) => candidate.spec.productionId === story.id);
      if (active && matching) setRun(matching);
    };
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [contract?.scopeId, contract?.scopeType, liveStep, story?.id]);

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
          createdBy: world.currentUserId,
          idempotencyKey: `production:${story.id}:${contract.format}:v1`,
          spec: {
            productionId: story.id,
            title: story.title,
            logline: story.logline,
            durationSeconds: contract.duration,
            shotCount: contract.shotCount,
            castCharacterIds: cast.map((character) => character.id),
            creativeDirection: story.creativeDirection ?? null,
            productImageUrl: story.productImageUrl ?? null,
            productImageName: story.productImageName ?? null,
            script: story.scenes.map((scene, index) => ({
              beat: index + 1,
              setting: scene.setting,
              objective: scene.objective ?? null,
              action: scene.action ?? null,
              durationSeconds: scene.durationSeconds ?? 4,
              previewImageUrl: scene.previewImageUrl ?? null,
              previewAssetId: scene.previewAssetId ?? null,
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

  async function transitionStep(
    activeRun: MediaPipelineRun,
    stepKey: string,
    action: PipelineStepAction,
    extra?: { output?: Record<string, unknown>; outputAssetId?: string; errorMessage?: string },
  ) {
    const response = await fetch(`/api/pipeline/${activeRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepKey, action, ...extra }),
    });
    const data = await response.json() as { run?: MediaPipelineRun; error?: string };
    if (!response.ok || !data.run) throw new Error(data.error ?? `Could not ${action} ${stepKey}.`);
    setRun(data.run);
    return data.run;
  }

  async function runInstantStep(activeRun: MediaPipelineRun, step: MediaPipelineStep) {
    let nextRun = activeRun;
    if (step.status === "failed") nextRun = await transitionStep(nextRun, step.key, "retry");
    const refreshed = nextRun.steps.find((candidate) => candidate.key === step.key);
    if (refreshed?.status === "ready") nextRun = await transitionStep(nextRun, step.key, "queue");
    const queued = nextRun.steps.find((candidate) => candidate.key === step.key);
    if (queued?.status === "queued") nextRun = await transitionStep(nextRun, step.key, "start");
    return transitionStep(nextRun, step.key, "complete", {
      output: { lockedAt: new Date().toISOString(), productionId: story?.id },
    });
  }

  async function generateReferenceFrame() {
    if (!run || !story || !cast[0]) return;
    setBusy(true);
    setError("");
    let activeRun = run;
    let providerStepStarted = false;
    try {
      const planStep = activeRun.steps.find((step) => step.key === "plan-lock");
      if (planStep && ["ready", "queued", "failed"].includes(planStep.status)) {
        activeRun = await runInstantStep(activeRun, planStep);
      }

      let imageStep = activeRun.steps.find((step) => step.key === "reference-frame");
      if (!imageStep) throw new Error("This production does not have a reference-frame step.");
      if (imageStep.status === "failed") {
        activeRun = await transitionStep(activeRun, imageStep.key, "retry");
        imageStep = activeRun.steps.find((step) => step.key === "reference-frame") ?? imageStep;
      }
      if (imageStep.status === "ready") {
        activeRun = await transitionStep(activeRun, imageStep.key, "queue");
        imageStep = activeRun.steps.find((step) => step.key === "reference-frame") ?? imageStep;
      }
      if (imageStep.status === "queued") {
        activeRun = await transitionStep(activeRun, imageStep.key, "start");
        providerStepStarted = true;
      } else if (imageStep.status === "running") {
        providerStepStarted = true;
      } else {
        throw new Error(`The reference frame is ${imageStep.status}, so it cannot be generated now.`);
      }

      const firstScene = story.scenes[0];
      const prompt = [
        `PURPOSE: First production frame for "${story.title}".`,
        `ACTOR: ${cast[0].name}. ${cast[0].personality}`,
        `DRAMATIC MOMENT: ${firstScene?.action ?? firstScene?.objective ?? story.logline}`,
        `SET: ${firstScene?.setting ?? "A location grounded in the locked script."}`,
        ...(story.productImageUrl
          ? [`PRODUCT: The second supplied reference is ${story.productImageName || "the advertised product"}. Preserve its exact shape, packaging, colors, proportions, label placement, materials, and recognizable details.`]
          : []),
        "CAMERA: cinematic 16:9 medium-wide frame, eye-level camera, 40mm lens, clear face and hands, intentional negative space for movement.",
        "LIGHTING: motivated directional key from the practical source in the scene, restrained fill, subtle edge separation, realistic contrast.",
        "CONTINUITY: preserve the actor's canonical face, age, hair, proportions, wardrobe materials, and palette exactly.",
        "EXCLUSIONS: no text, logo, watermark, montage, duplicate person, generic pose, or unexplained visual effects.",
      ].join("\n");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "image",
          characterId: cast[0].id,
          character: cast[0],
          prompt,
          imagePurpose: "scene",
          referenceImages: [
            cast[0].imageUrl ?? cast[0].galleryUrls?.[0] ?? cast[0].bannerUrl ?? "",
            story.productImageUrl ?? "",
          ].filter(Boolean),
        }),
      });
      const data = await response.json() as { url?: string; assetId?: string; error?: string };
      if (!response.ok || !data.url || !data.assetId) {
        throw new Error(data.error ?? "Seedream completed without a saved reference frame.");
      }
      activeRun = await transitionStep(activeRun, "reference-frame", "complete", {
        outputAssetId: data.assetId,
        output: { url: data.url, imagePrompt: prompt, characterId: cast[0].id },
      });
      setRun(activeRun);
    } catch (generationError) {
      if (providerStepStarted) {
        await transitionStep(activeRun, "reference-frame", "fail", {
          errorMessage: generationError instanceof Error ? generationError.message : "Reference-frame generation failed.",
        }).catch(() => undefined);
      }
      setError(generationError instanceof Error ? generationError.message : "Reference-frame generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveReferenceFrame() {
    if (!run || !referenceImageUrl) return;
    setBusy(true);
    setError("");
    try {
      let activeRun = run;
      let reviewStep = activeRun.steps.find((step) => step.key === "reference-review");
      if (!reviewStep) throw new Error("This production does not have an identity review gate.");
      if (reviewStep.status === "approved" || reviewStep.status === "succeeded") return;
      if (reviewStep.status === "ready") {
        activeRun = await transitionStep(activeRun, reviewStep.key, "queue");
        reviewStep = activeRun.steps.find((step) => step.key === "reference-review") ?? reviewStep;
      }
      if (reviewStep.status === "queued") {
        activeRun = await transitionStep(activeRun, reviewStep.key, "start");
        reviewStep = activeRun.steps.find((step) => step.key === "reference-review") ?? reviewStep;
      }
      if (reviewStep.status === "running") {
        activeRun = await transitionStep(activeRun, reviewStep.key, "complete", {
          output: {
            approvedReferenceUrl: referenceImageUrl,
            approvedAt: new Date().toISOString(),
            productionId: story?.id,
          },
        });
        reviewStep = activeRun.steps.find((step) => step.key === "reference-review") ?? reviewStep;
      }
      if (reviewStep.status === "needs_review") {
        activeRun = await transitionStep(activeRun, reviewStep.key, "approve", {
          output: {
            approvedReferenceUrl: referenceImageUrl,
            approvedAt: new Date().toISOString(),
            productionId: story?.id,
          },
        });
      }
      setRun(activeRun);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "The reference frame could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePipelineAudio(input: Record<string, unknown>) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Audio generation failed." })) as { error?: string };
      throw new Error(data.error ?? "Audio generation failed.");
    }
    const url = response.headers.get("X-Asset-Url");
    const assetId = response.headers.get("X-Asset-Id");
    if (!url || !assetId) throw new Error("Generated audio was not attached to the production.");
    return { url, assetId };
  }

  async function continueProduction(startingRun: MediaPipelineRun) {
    if (!story || !cast[0]) return;
    setBusy(true);
    setError("");
    let activeRun = startingRun;
    let activeStepKey = "";
    try {
      while (true) {
        let step = activeRun.steps.find((candidate) => candidate.status === "ready");
        if (!step) break;
        if (step.requiresReview && step.key !== "creative-review") break;
        activeStepKey = step.key;
        activeRun = await transitionStep(activeRun, step.key, "queue");
        activeRun = await transitionStep(activeRun, step.key, "start");
        step = activeRun.steps.find((candidate) => candidate.key === activeStepKey) ?? step;

        let output: Record<string, unknown> = { completedAt: new Date().toISOString() };
        let outputAssetId: string | undefined;
        const firstScene = story.scenes[0];
        if (step.key === "motion-plate") {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "video",
              characterId: cast[0].id,
              referenceImage: referenceImageUrl,
              prompt: [
                `Animate the approved first frame for ${story.title} as one continuous five-second silent performance plate.`,
                `PERFORMANCE: ${firstScene?.action ?? firstScene?.objective ?? story.logline}`,
                "IDENTITY: keep the exact face, age, hair, body proportions, wardrobe, materials, and lighting from the supplied frame.",
                "MOVEMENT: one restrained readable actor action, natural breathing and eye movement, physically plausible fabric motion.",
                "CAMERA: one subtle motivated push or locked camera; no cuts, reframing jumps, morphing, or new subjects.",
                "AUDIO: silent visual plate only; audio is produced separately.",
              ].join("\n"),
            }),
          });
          const data = await response.json() as { url?: string; assetId?: string; error?: string };
          if (!response.ok || !data.url || !data.assetId) throw new Error(data.error ?? "Seedance did not return a motion plate.");
          output = { ...output, url: data.url, referenceImageUrl };
          outputAssetId = data.assetId;
        } else if (step.key === "dialogue") {
          const line = story.scenes.flatMap((scene) => scene.lines).find((candidate) => candidate.characterId === cast[0].id)?.text
            ?? story.scenes.flatMap((scene) => scene.lines)[0]?.text
            ?? cast[0].tagline;
          const asset = await generatePipelineAudio({ action: "speech", characterId: cast[0].id, speechText: line });
          output = { ...output, url: asset.url, text: line };
          outputAssetId = asset.assetId;
        } else if (step.key === "sfx") {
          const prompt = `A clean 1.5-second non-musical physical sound for ${story.title}: ${cast[0].sfxDesc}. One foreground event, no speech, no melody, no ambience tail.`;
          const asset = await generatePipelineAudio({ action: "sfx", characterId: cast[0].id, prompt, durationSeconds: 1.5 });
          output = { ...output, url: asset.url, prompt };
          outputAssetId = asset.assetId;
        } else if (step.key === "room-tone") {
          const prompt = `Two seconds of clean room tone for ${firstScene?.setting ?? "the scene location"}. Stable low-level environmental ambience only, no distinct event, speech, music, melody, or dramatic rise.`;
          const asset = await generatePipelineAudio({ action: "sfx", characterId: cast[0].id, prompt, durationSeconds: 2 });
          output = { ...output, url: asset.url, prompt };
          outputAssetId = asset.assetId;
        } else if (step.key === "shot-mix") {
          const response = await fetch("/api/pipeline/mix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runId: activeRun.id, characterId: cast[0].id }),
          });
          const data = await response.json() as { url?: string; assetId?: string; error?: string };
          if (!response.ok || !data.url || !data.assetId) throw new Error(data.error ?? "The shot could not be mixed.");
          output = { ...output, url: data.url, durationSeconds: 5 };
          outputAssetId = data.assetId;
        } else if (step.key === "technical-qc") {
          const mixedUrl = activeRun.steps.find((candidate) => candidate.key === "shot-mix")?.output.url;
          if (typeof mixedUrl !== "string") throw new Error("Technical QC needs a mixed shot.");
          output = { ...output, url: mixedUrl, checks: ["picture", "audio", "duration", "delivery"] };
          outputAssetId = activeRun.steps.find((candidate) => candidate.key === "shot-mix")?.outputAssetId ?? undefined;
        } else if (step.key === "creative-review") {
          const mixedUrl = activeRun.steps.find((candidate) => candidate.key === "shot-mix")?.output.url;
          output = { ...output, url: mixedUrl, review: "human" };
          outputAssetId = activeRun.steps.find((candidate) => candidate.key === "shot-mix")?.outputAssetId ?? undefined;
        }

        activeRun = await transitionStep(activeRun, step.key, "complete", { output, outputAssetId });
        if (step.key === "creative-review") break;
      }
      setRun(activeRun);
    } catch (pipelineError) {
      if (activeStepKey) {
        await transitionStep(activeRun, activeStepKey, "fail", {
          errorMessage: pipelineError instanceof Error ? pipelineError.message : "Production generation failed.",
        }).catch(() => undefined);
      }
      setError(pipelineError instanceof Error ? pipelineError.message : "Production generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function renderPunchOutput() {
    if (!run || !story || !cast[0] || contract?.format !== "punch") return;
    const lockedReference = referenceImageUrl ?? castPreviewImageUrl;
    if (!lockedReference) {
      setError("Approve or attach one actor identity frame before rendering the Punch.");
      return;
    }
    setBusy(true);
    setError("");
    setRenderProgress("Preparing the locked actor reference");
    setRenderFrameUrl(null);
    try {
      const shotResults: Array<{ frameUrl: string; frameAssetId?: string; url: string; assetId: string }> = [];
      const shotDesigns = [
        "ESTABLISHING HOOK: a readable medium-wide view that clearly establishes the business, its merchandise, and the actor entering or discovering the situation.",
        "PRODUCT ACTION: a medium performance shot where the actor physically interacts with the advertised product or the business offering; the product remains clearly visible and correctly scaled.",
        "PROOF OR REVERSAL: show the visible result, reaction, or situation change that makes the promise believable without explanation.",
        "PAYOFF: a tighter final composition that lands the actor's memorable choice while ending on a clean, unmistakable product or storefront hero moment.",
      ];
      for (let index = 0; index < contract.shotCount; index += 1) {
        setRenderProgress(`Designing scene frame ${index + 1} of ${contract.shotCount}`);
        const scene = story.scenes[index % Math.max(story.scenes.length, 1)];
        const framePrompt = [
          `PURPOSE: Scene frame ${index + 1} of ${contract.shotCount} for the ${contract.duration}-second Punch "${story.title}".`,
          `STORY: ${story.logline}`,
          `SHOT JOB: ${shotDesigns[index] ?? shotDesigns[shotDesigns.length - 1]}`,
          `LOCATION: ${scene?.setting ?? "the specific business location established by the story"}. The location must be immediately recognizable on screen.`,
          `VISIBLE ACTION: ${scene?.action ?? scene?.objective ?? story.logline}`,
          `ACTOR: ${cast[0].name}, matching the supplied actor reference exactly. ${cast[0].personality}`,
          ...(story.productImageUrl
            ? [`PRODUCT LOCK: The supplied product reference is ${story.productImageName || "the advertised product"}. Show that exact product prominently and preserve its packaging, shape, color, materials, proportions, and label placement.`]
            : ["OFFERING VISIBILITY: Show the actual goods or service being advertised in the environment and in the actor's action. Do not create an empty portrait-only frame."]),
          "COMPOSITION: cinematic 16:9 advertising frame with clear foreground, subject, business environment, and product storytelling. The frame must not look like a portrait session.",
          "CAMERA: one intentional camera angle appropriate to this shot job; realistic lens perspective; face, hands, environment, and product all readable.",
          "LIGHT: motivated commercial-cinematic lighting grounded in visible practical sources, realistic skin and materials, controlled contrast.",
          "CONTINUITY: same exact actor identity, wardrobe, business location, product design, palette, and time of day across every scene frame.",
          "REALISM: photoreal live-action unless the story explicitly requests animation, manga, or illustration.",
          "EXCLUSIONS: no replacement actor, extra principal character, identity blend, generic portrait background, empty room, missing product, text overlay, UI, border, or watermark.",
        ].join("\n");
        let frameData: { url?: string; assetId?: string; error?: string } = {
          url: scene?.previewImageUrl,
          assetId: scene?.previewAssetId,
        };
        if (!frameData.url) {
          const frameResponse = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "image",
              characterId: cast[0].id,
              imagePurpose: "scene",
              referenceImages: [lockedReference, story.productImageUrl ?? ""].filter(Boolean),
              prompt: framePrompt,
            }),
          });
          frameData = await frameResponse.json() as { url?: string; assetId?: string; error?: string };
          if (!frameResponse.ok || !frameData.url) {
            throw new Error(frameData.error ?? `Scene frame ${index + 1} was not created.`);
          }
        }
        setRenderFrameUrl(frameData.url);

        setRenderProgress(`Animating four-second scene ${index + 1} of ${contract.shotCount}`);
        const motionPrompt = [
          `Animate four-second scene ${index + 1} of ${contract.shotCount} for the ${contract.duration}-second Punch "${story.title}" from the supplied scene frame.`,
          `PERFORMANCE: ${scene?.action ?? scene?.objective ?? story.logline}`,
          "FRAME LOCK: the supplied image is the finished art direction. Preserve its exact actor, face, wardrobe, product, merchandise, set dressing, layout, lighting, and color.",
          "PRODUCT LOCK: keep every visible product present, recognizable, correctly shaped, and stable. Do not remove, replace, relabel, or morph it.",
          "MOVEMENT: one concise, physically plausible actor action with natural eyes, hands, fabric, and object interaction.",
          "CAMERA: one restrained motivated movement or locked camera; no cut, montage, jump, reframing reset, or new angle.",
          "TIMING: one readable four-second scene with a beginning, action, and landing. The source generation may include extra tail frames; editing trims the clip to four seconds.",
          "CAST EXCLUSION: do not introduce, replace, blend, age-shift, or redesign any person.",
          "AUDIO: silent visual plate only; sound is produced separately.",
        ].join("\n");
        const videoResponse = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "video",
            characterId: cast[0].id,
            referenceImage: frameData.url,
            prompt: motionPrompt,
          }),
        });
        const videoData = await videoResponse.json() as { url?: string; assetId?: string; error?: string };
        if (!videoResponse.ok || !videoData.url || !videoData.assetId) {
          throw new Error(videoData.error ?? `Scene ${index + 1} did not produce a saved video.`);
        }
        shotResults.push({
          frameUrl: frameData.url,
          frameAssetId: frameData.assetId,
          url: videoData.url,
          assetId: videoData.assetId,
        });
      }

      setRenderProgress(`Assembling the ${contract.duration}-second master`);
      const response = await fetch("/api/pipeline/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.id,
          characterId: cast[0].id,
          shotUrls: shotResults.map((shot) => shot.url),
          frameUrls: shotResults.map((shot) => shot.frameUrl),
          sceneDurationSeconds: 4,
          finalDurationSeconds: contract.duration,
        }),
      });
      const data = await response.json() as { run?: MediaPipelineRun; error?: string };
      if (!response.ok || !data.run) throw new Error(data.error ?? "The Punch master could not be assembled.");
      setRun(data.run);
      setRenderProgress("");
      window.setTimeout(() => {
        document.querySelector("[data-human-review]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : "The Punch output could not be rendered.");
      setRenderProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function approveFinalShot() {
    if (!run) return;
    const step = run.steps.find((candidate) => candidate.key === "creative-review");
    if (!step || step.status !== "needs_review") return;
    if (!finalVideoUrl) {
      setError("There is no playable master to approve yet. Generate the review cut first.");
      document.querySelector("[data-human-review]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const activeRun = await transitionStep(run, step.key, "approve", {
        output: { ...step.output, approvedAt: new Date().toISOString() },
        outputAssetId: step.outputAssetId ?? undefined,
      });
      setRun(activeRun);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "The final shot could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  const nextAutomaticStep = run?.steps.find((step) => (
    step.status === "ready"
    && !step.requiresReview
    && AUTOMATED_SHOT_STEPS.has(step.key)
  ));
  useEffect(() => {
    if (!run || !nextAutomaticStep || busy) return;
    const key = `${run.id}:${nextAutomaticStep.id}:${nextAutomaticStep.attempt}`;
    if (autoStepRef.current === key) return;
    autoStepRef.current = key;
    void continueProduction(run);
    // continueProduction intentionally follows the persisted run state, not function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, nextAutomaticStep?.attempt, nextAutomaticStep?.id, run?.id]);

  if (!hydrated) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-sm text-grey">Opening production...</main>;
  }

  if (!story || !contract) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-grey">This production draft is not available on this device.</p>
        <Link href="/studio" className="mt-4 inline-block text-accent">Back to My Studio</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/studio" className="text-xs text-grey hover:text-accent">Back to My Studio</Link>
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

      <section className="hidden gap-3 border-b border-line py-6 sm:grid sm:grid-cols-3">
        {[
          ["01", "Script locked", `${story.scenes.length} playable beat${story.scenes.length === 1 ? "" : "s"}`],
          ["02", "Cast locked", `${cast.length} production identit${cast.length === 1 ? "y" : "ies"}`],
          ["03", run ? "Production plan created" : "Ready to initialize", run ? `Current gate: ${run.currentStep ?? "complete"}` : "Start the production pipeline"],
        ].map(([number, label, detail]) => (
          <div key={number} className="flex items-start gap-3">
            <span className="font-mono text-xs text-accent">{number}</span>
            <div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-[10px] text-grey">{detail}</p></div>
          </div>
        ))}
      </section>

      {!run && (
        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Your script and cast are ready.</p>
            <p className="mt-1 text-xs text-grey">Create the shot plan, then review the first frame before anything else is generated.</p>
          </div>
          <button
            type="button"
            onClick={() => void initializeProduction()}
            disabled={busy || loading || !contract.scopeId}
            className="accent-btn min-h-12 shrink-0 rounded-full px-7 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Preparing production..." : "Continue to production"}
          </button>
        </section>
      )}
      {!run && error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      {run && (
      <section className="hidden">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            finalVideoUrl || referenceImageUrl ? "bg-emerald-400" : busy ? "animate-pulse bg-accent" : "bg-amber-300"
          }`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {referenceImageUrl
                ? "First frame created"
                : busy
                  ? "Seedream is creating the first frame"
                  : run
                    ? "Production plan only · no media yet"
                    : "Script ready · production not initialized"}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-grey">
              Script: My Studio on this device
              <span className="px-1.5 text-white/20">·</span>
              Plan: {run ? `Supabase ${run.id.slice(0, 8)}` : "not created"}
              <span className="px-1.5 text-white/20">·</span>
              Media: {referenceImageUrl ? "actor library + this production" : "nothing generated"}
            </p>
          </div>
        </div>
        {!referenceImageUrl && run.steps.some((step) => step.key === "reference-frame") ? (
          <button
            type="button"
            onClick={() => void generateReferenceFrame()}
            disabled={busy}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Creating..." : "Create first frame"}
          </button>
        ) : null}
      </section>
      )}

      {run && (
        <section
          className={`mt-4 overflow-hidden rounded-[1.75rem] border shadow-[0_24px_80px_rgba(0,0,0,0.3)] ${
            finalVideoUrl ? "border-emerald-400/45" : "border-amber-300/45"
          }`}
          data-production-preview-primary
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/35 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {productionState.tone === "live" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  finalVideoUrl
                    ? "bg-emerald-400"
                    : productionState.tone === "live"
                      ? "bg-accent"
                      : productionState.tone === "failed"
                        ? "bg-red-400"
                        : "bg-amber-300"
                }`} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-white/75">
                  {finalVideoUrl ? "Final preview · ready to review" : productionState.eyebrow}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-grey">
                  {finalVideoUrl
                    ? `${contract.duration}s master · ${contract.shotCount} shots`
                    : productionState.detail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {finalVideoUrl && contract.format === "punch" && (
                <button
                  type="button"
                  onClick={() => void renderPunchOutput()}
                  disabled={busy}
                  className="rounded-full border border-accent/55 px-3 py-1.5 text-[9px] font-semibold text-accent disabled:opacity-40"
                >
                  {busy ? renderProgress || "Rebuilding…" : "Rebuild scenes"}
                </button>
              )}
              <div className="text-right">
                <p className="font-mono text-[10px] text-white">{mediaProgress}% media</p>
                <p className="text-[8px] uppercase tracking-[0.12em] text-grey">
                  {completedStepCount}/{run.steps.length} workflow steps
                </p>
              </div>
            </div>
          </div>

          <div className="relative aspect-video overflow-hidden bg-black">
            {previewVideoUrl ? (
              <video
                key={previewVideoUrl}
                src={previewVideoUrl}
                autoPlay
                muted
                loop={!finalVideoUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
                aria-label={`Production preview for ${story.title}`}
              />
            ) : previewImageUrl ? (
              <div
                className={`h-full w-full bg-cover bg-center transition duration-700 ${busy ? "scale-[1.02] opacity-75" : ""}`}
                style={{ backgroundImage: `url("${previewImageUrl.replaceAll('"', "%22")}")` }}
                role="img"
                aria-label={`Locked actor waiting for preview generation for ${story.title}`}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <span className="reel-title text-7xl text-white/15">{cast[0]?.name.slice(0, 1) ?? "C"}</span>
                  <p className="mt-2 text-xs text-grey">No actor image or rendered media is attached.</p>
                </div>
              </div>
            )}

            {!previewVideoUrl && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/35" />}
            {(busy || liveStep) && !previewVideoUrl && (
              <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-[pipeline-live-sweep_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent blur-xl" />
            )}
            {!previewVideoUrl && (
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-lg">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-200">
                    {productionState.eyebrow}
                  </p>
                  <h2 className="reel-title mt-1 text-3xl text-white">
                    {productionState.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-white/65">
                    {productionState.detail}
                  </p>
                  {previewImageUrl && !referenceImageUrl && (
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      Identity reference only · this is not generated production media
                    </p>
                  )}
                </div>
                {contract.format === "punch" && (
                  <button
                    type="button"
                    onClick={() => void renderPunchOutput()}
                    disabled={busy}
                    className="shrink-0 rounded-full bg-accent px-5 py-3 text-xs font-bold text-white shadow-[0_12px_34px_rgba(244,63,105,0.35)] disabled:opacity-40"
                  >
                    {busy ? renderProgress || "Rendering…" : reviewHasNoMedia ? "Generate missing preview →" : "Generate preview →"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className={`flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            productionState.tone === "failed"
              ? "border-red-400/30 bg-red-400/[0.07]"
              : productionState.tone === "live"
                ? "border-accent/30 bg-accent/[0.06]"
                : "border-amber-300/25 bg-amber-300/[0.05]"
          }`}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                {productionState.tone === "live" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  productionState.tone === "live"
                    ? "animate-pulse bg-accent"
                    : productionState.tone === "failed"
                      ? "bg-red-400"
                      : "bg-amber-300"
                }`} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">{productionState.eyebrow}</p>
                <p className="mt-1 text-sm font-semibold text-white">{productionState.title}</p>
                <p className="mt-1 text-[10px] leading-4 text-grey">{productionState.detail}</p>
              </div>
            </div>
            {!busy && !finalVideoUrl && contract.format === "punch" && (
              <button
                type="button"
                onClick={() => void renderPunchOutput()}
                className="shrink-0 rounded-full border border-accent px-4 py-2 text-[10px] font-bold text-accent hover:bg-accent hover:text-white"
              >
                {error ? "Retry preview" : "Generate preview"}
              </button>
            )}
            {!busy && reviewStep && finalVideoUrl && (
              <button
                type="button"
                onClick={() => document.querySelector("[data-human-review]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="shrink-0 rounded-full border border-amber-300/60 px-4 py-2 text-[10px] font-bold text-amber-200 hover:bg-amber-300/10"
              >
                Open approval
              </button>
            )}
            {!busy && !referenceImageUrl && contract.format !== "punch" && run.steps.some((step) => step.key === "reference-frame") && (
              <button
                type="button"
                onClick={() => void generateReferenceFrame()}
                className="shrink-0 rounded-full border border-accent px-4 py-2 text-[10px] font-bold text-accent hover:bg-accent hover:text-white"
              >
                Create first frame
              </button>
            )}
          </div>
        </section>
      )}

      <div className={`mt-8 grid gap-8 ${run ? "lg:grid-cols-[0.72fr_1.28fr]" : ""}`}>
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

          <div
            className="hidden"
            data-production-preview
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  {(liveStep || busy) && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${
                    finalVideoUrl ? "bg-emerald-400" : liveStep || busy ? "bg-accent" : "bg-amber-300"
                  }`} />
                </span>
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-white/75">
                  {finalVideoUrl ? "Master preview" : previewVideoUrl ? "Motion preview" : referenceImageUrl ? "Frame preview" : "Production canvas"}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[9px] text-grey">{pipelineProgress}%</span>
            </div>

            <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(244,63,105,0.13),transparent_45%),#050805]">
              {previewVideoUrl ? (
                <video
                  key={previewVideoUrl}
                  src={previewVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  className="h-full w-full object-cover"
                  aria-label={`Live production preview for ${story.title}`}
                />
              ) : previewImageUrl ? (
                <div
                  className={`h-full w-full bg-cover bg-center transition-all duration-700 ${
                    busy || liveStep ? "scale-[1.03] opacity-80" : ""
                  }`}
                  style={{ backgroundImage: `url("${previewImageUrl.replaceAll('"', "%22")}")` }}
                  role="img"
                  aria-label={referenceImageUrl
                    ? `Generated frame preview for ${story.title}`
                    : `Locked actor preview for ${story.title}`}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="reel-title text-6xl text-white/15">{cast[0]?.name.slice(0, 1) ?? "C"}</span>
                </div>
              )}

              {!previewVideoUrl && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" />}
              {(busy || liveStep) && !previewVideoUrl && (
                <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-[pipeline-live-sweep_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/12 to-transparent blur-xl" />
              )}

              {!previewVideoUrl && (
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-accent-secondary">
                    {referenceImageUrl ? "Generated frame locked" : "Using actor identity seed"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/75">
                    {liveStep
                      ? liveStepCopy(liveStep)
                      : referenceImageUrl
                        ? "This frame becomes the visual source for motion and continuity."
                        : "The canvas will update here as soon as the first production frame is generated."}
                  </p>
                </div>
              )}
            </div>

            <div className="px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[10px] font-semibold">
                  {liveStep?.label ?? (finalVideoUrl ? "Final output ready" : referenceImageUrl ? "Reference frame ready" : "Waiting for first frame")}
                </p>
                <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-grey">
                  {liveStep ? `${elapsedLabel(liveElapsedSeconds)} live` : `${completedStepCount}/${run?.steps.length ?? 0} stages`}
                </span>
              </div>
              <div className="mt-2 flex gap-1">
                {(run?.steps ?? []).map((step) => (
                  <span
                    key={step.id}
                    className={`h-1 min-w-0 flex-1 rounded-full ${
                      step.status === "succeeded" || step.status === "approved"
                        ? "bg-emerald-400"
                        : step.status === "needs_review"
                          ? "bg-amber-300"
                          : step.status === "running" || step.status === "queued"
                            ? "animate-pulse bg-accent"
                            : "bg-white/10"
                    }`}
                    title={`${step.label}: ${step.status.replaceAll("_", " ")}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {run && <section>
          <div
            id="production-output"
            className={`mb-5 overflow-hidden rounded-2xl border ${
              finalVideoUrl ? "border-emerald-400/40 bg-emerald-400/[0.05]" : "border-amber-300/35 bg-amber-300/[0.05]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${finalVideoUrl ? "bg-emerald-400" : busy ? "animate-pulse bg-accent" : "bg-amber-300"}`} />
                  <p className={`text-[9px] font-bold uppercase tracking-[0.2em] ${finalVideoUrl ? "text-emerald-300" : "text-amber-200"}`}>
                    {finalVideoUrl ? "Output ready" : busy ? "Rendering output" : "Output missing"}
                  </p>
                </div>
                <h2 className="reel-title mt-2 text-3xl">
                  {finalVideoUrl ? `${contract.duration}-second ${contract.definition.label} master` : "There is no video file yet"}
                </h2>
                <p className="mt-2 text-xs leading-5 text-grey">
                  {finalVideoUrl
                    ? "This is the actual rendered deliverable attached to the production—not the workflow timeline."
                    : contract.format === "punch"
                      ? "The checklist advanced, but it never created or attached the four scene clips. Render them now to create the real 15-second output."
                      : "The pipeline has not attached a playable deliverable to this production yet."}
                </p>
              </div>
              {!finalVideoUrl && contract.format === "punch" && (
                <button
                  type="button"
                  onClick={() => void renderPunchOutput()}
                  disabled={busy}
                  className="rounded-full bg-accent px-5 py-3 text-xs font-bold text-white shadow-[0_12px_34px_rgba(244,63,105,0.28)] disabled:opacity-40"
                >
                  {busy ? renderProgress || "Rendering…" : "Render 15-second output →"}
                </button>
              )}
            </div>
            {finalVideoUrl && (
              <div className="border-t border-emerald-400/20 bg-black p-3">
                <video
                  src={finalVideoUrl}
                  controls
                  playsInline
                  className="aspect-video w-full rounded-xl bg-black object-contain"
                  aria-label={`Final output for ${story.title}`}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-emerald-300">
                    {contract.duration}s · {contract.shotCount} shots · attached to this production
                  </p>
                  <a
                    href={finalVideoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-semibold hover:border-accent hover:text-accent"
                  >
                    Open output ↗
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className={`${contract.format === "punch" ? "hidden" : ""} mb-8 overflow-hidden rounded-2xl border border-line`}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${referenceImageUrl ? "bg-emerald-400" : "bg-amber-300"}`} />
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-grey">
                    {referenceImageUrl ? "First output ready" : "No media generated yet"}
                  </p>
                </div>
                <h2 className="reel-title mt-2 text-2xl">
                  {referenceImageUrl ? "Your reference frame is here" : "The script created a production plan"}
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-grey">
                  {referenceImageUrl
                    ? "The image provider saved this frame to the actor's media library and attached it to this production run."
                    : "Nothing is rendering in the background. Start the first frame here when you are ready to call Seedream."}
                </p>
              </div>
              {!referenceImageUrl && run?.steps.some((step) => step.key === "reference-frame") && (
                <button
                  type="button"
                  onClick={() => void generateReferenceFrame()}
                  disabled={busy}
                  className="rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {busy ? "Creating first frame..." : "Create first frame"}
                </button>
              )}
            </div>

            <div className="grid gap-px bg-line sm:grid-cols-3">
              <div className="bg-paper p-3.5">
                <p className="text-[8px] uppercase tracking-[0.16em] text-grey">Script</p>
                <p className="mt-1 text-xs font-semibold">My Studio · this device</p>
              </div>
              <div className="bg-paper p-3.5">
                <p className="text-[8px] uppercase tracking-[0.16em] text-grey">Production plan</p>
                <p className="mt-1 truncate text-xs font-semibold">{run ? `Supabase · ${run.id.slice(0, 8)}` : "Not initialized"}</p>
              </div>
              <div className="bg-paper p-3.5">
                <p className="text-[8px] uppercase tracking-[0.16em] text-grey">Media</p>
                <p className="mt-1 text-xs font-semibold">{referenceImageUrl ? "1 Seedream frame" : "Nothing generated"}</p>
              </div>
            </div>

            {finalVideoUrl && contract.format !== "punch" && (
              <div className="border-t border-line bg-black p-3">
                <video
                  src={finalVideoUrl}
                  controls
                  playsInline
                  className="aspect-video w-full rounded-xl bg-black object-contain"
                  aria-label={`Final mixed shot for ${story.title}`}
                />
                <p className="mt-2 text-[9px] uppercase tracking-[0.16em] text-emerald-300">Final picture, locked voice, effects, and room tone</p>
              </div>
            )}

            {referenceImageUrl && (
              <>
                <div
                  className="aspect-video w-full bg-black bg-cover bg-center"
                  style={{ backgroundImage: `url("${referenceImageUrl.replaceAll('"', "%22")}")` }}
                  role="img"
                  aria-label={`Generated reference frame for ${story.title}`}
                />
                {(() => {
                  const reviewStep = run.steps.find((step) => step.key === "reference-review");
                  const approved = reviewStep?.status === "approved" || reviewStep?.status === "succeeded";
                  return (
                    <div className={`flex flex-col gap-4 border-t p-4 sm:flex-row sm:items-center sm:justify-between ${
                      approved ? "border-emerald-400/30 bg-emerald-400/[0.07]" : "border-amber-300/30 bg-amber-300/[0.07]"
                    }`}>
                      <div>
                        <p className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${approved ? "text-emerald-300" : "text-amber-200"}`}>
                          {approved ? "Identity and composition approved" : "Human approval required"}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-grey">
                          {approved
                            ? "This frame is locked as the visual source for motion. Seedance is now unlocked."
                            : "Check the actor's face, wardrobe, composition, and lighting. Approve this exact frame to unlock motion generation."}
                        </p>
                      </div>
                      {!approved && (
                        <button
                          type="button"
                          onClick={() => void approveReferenceFrame()}
                          disabled={busy}
                          className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-bold text-[#07160a] shadow-[0_10px_30px_rgba(52,211,153,0.2)] disabled:opacity-40"
                        >
                          {busy ? "Approving..." : "Approve frame and continue"}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[0.2em] text-grey">Production state</p><h2 className="reel-title mt-1 text-3xl">From script to approved output</h2></div>
          </div>

          {liveStep && (
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-accent/60 bg-accent/[0.08] p-4 shadow-[0_0_38px_rgba(244,63,105,0.12)]" data-live-pipeline-step aria-live="polite">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/10">
                <span className="block h-full w-1/3 animate-[pipeline-live-sweep_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent to-transparent" />
              </div>
              <div className="flex items-start gap-3">
                <span className="relative mt-1 flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_rgba(244,63,105,0.9)]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">Live now · {liveStep.executor}</p>
                    <span className="font-mono text-[9px] text-accent">{elapsedLabel(liveElapsedSeconds)} elapsed</span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold">{liveStep.label}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-grey">{liveStepCopy(liveStep)}</p>
                </div>
              </div>
            </div>
          )}

          <ol className="relative mt-6 border-l border-line pl-7">
            {run.steps.map((step, index) => {
              const isLive = step.status === "running" || step.status === "queued";
              const displayStatus = step.status === "succeeded"
                && OUTPUT_REQUIRED_STEPS.has(step.key)
                && !stepHasAttachedOutput(step)
                ? "planned"
                : step.status;
              return (
              <li key={step.id} className={`relative pb-7 last:pb-0 ${isLive ? "rounded-r-xl bg-accent/[0.035] py-2 pr-2" : ""}`}>
                <span className={`absolute -left-[2.14rem] top-0 flex h-4 w-4 items-center justify-center rounded-full border bg-paper ${stepTone(displayStatus)} ${isLive ? "shadow-[0_0_18px_rgba(244,63,105,0.55)]" : ""}`}>
                  {isLive && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40" />}
                  <span className={`relative h-1.5 w-1.5 rounded-full bg-current ${isLive ? "animate-pulse" : ""}`} />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] text-grey">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-[9px] uppercase tracking-wide text-accent-secondary">{step.executor}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase ${stepTone(displayStatus)} ${isLive ? "animate-pulse" : ""}`}>
                    {isLive ? `live · ${step.status}` : displayStatus}
                  </span>
                  {step.requiresReview && <span className="text-[8px] uppercase text-amber-200">human approval</span>}
                </div>
                <h3 className="mt-1 text-sm font-semibold">{step.label}</h3>
                {displayStatus === "planned" && (
                  <p className="mt-1 text-[10px] leading-4 text-grey">
                    Planned only · no generated asset is attached to this step.
                  </p>
                )}
                {isLive && <p className="mt-1 text-[10px] leading-4 text-grey">{liveStepCopy(step)}</p>}
                {step.key === "reference-review" && referenceImageUrl && !["approved", "succeeded"].includes(step.status) && (
                  <button
                    type="button"
                    onClick={() => void approveReferenceFrame()}
                    disabled={busy}
                    className="mt-3 rounded-full border border-emerald-400/70 px-4 py-2 text-[10px] font-semibold text-emerald-300 disabled:opacity-40"
                  >
                    {busy ? "Approving..." : "Review frame above · Approve"}
                  </button>
                )}
                {step.key === "creative-review" && step.status === "needs_review" && (
                  <div
                    className="mt-4 overflow-hidden rounded-2xl border border-amber-300/45 bg-amber-300/[0.06]"
                    data-human-review
                  >
                    <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_150px]">
                      <div className="bg-black">
                        {finalVideoUrl ? (
                          <video
                            src={finalVideoUrl}
                            controls
                            playsInline
                            className="aspect-video w-full bg-black object-contain"
                            aria-label={`Punch review cut for ${story.title}`}
                          />
                        ) : previewImageUrl ? (
                          <div
                            className="relative aspect-video w-full bg-cover bg-center"
                            style={{ backgroundImage: `url("${previewImageUrl.replaceAll('"', "%22")}")` }}
                            role="img"
                            aria-label={`Locked identity for ${cast[0]?.name ?? story.title}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200">Review cut not rendered</p>
                              <p className="mt-1 text-xs text-white/75">Generate the four identity-locked scene clips before approval.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex aspect-video items-center justify-center p-6 text-center text-xs text-grey">
                            No actor identity frame is available for review.
                          </div>
                        )}
                      </div>

                      <div className="border-t border-amber-300/20 p-3 sm:border-l sm:border-t-0">
                        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-amber-200">Identity lock</p>
                        {previewImageUrl && (
                          <div
                            className="mt-2 aspect-square w-14 rounded-full border-2 border-amber-200/55 bg-cover bg-center"
                            style={{ backgroundImage: `url("${previewImageUrl.replaceAll('"', "%22")}")` }}
                            role="img"
                            aria-label={`${cast[0]?.name ?? "Actor"} identity reference`}
                          />
                        )}
                        <p className="mt-2 text-xs font-semibold">{cast[0]?.name ?? "Locked actor"}</p>
                        <p className="mt-1 text-[9px] leading-4 text-grey">
                          Every shot must match this exact face, age, hair, wardrobe, and silhouette.
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-amber-300/20 p-4">
                      <p className="text-xs font-semibold">
                        {finalVideoUrl ? "Watch the exact cut before approving it." : "There is nothing playable to approve yet."}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-grey">
                        {finalVideoUrl
                          ? "If any shot shows a different person, regenerate the cut. Approval locks this exact media."
                          : "The yellow review state is a gate, not a completion. Generate a review cut to continue."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!finalVideoUrl && (
                          <button
                            type="button"
                            onClick={() => void renderPunchOutput()}
                            disabled={busy || contract.format !== "punch"}
                            className="rounded-full bg-accent px-4 py-2 text-[10px] font-bold text-white disabled:opacity-40"
                          >
                            {busy ? renderProgress || "Generating review cut…" : "Generate 4 scene clips →"}
                          </button>
                        )}
                        {finalVideoUrl && (
                          <>
                          <button
                    type="button"
                    onClick={() => void approveFinalShot()}
                    disabled={busy}
                    className="rounded-full bg-emerald-400 px-4 py-2 text-[10px] font-bold text-[#07160a] disabled:opacity-40"
                  >
                    {busy ? "Approving…" : "Approve this exact cut"}
                  </button>
                            <button
                              type="button"
                              onClick={() => void renderPunchOutput()}
                              disabled={busy || contract.format !== "punch"}
                              className="rounded-full border border-amber-300/60 px-4 py-2 text-[10px] font-semibold text-amber-100 disabled:opacity-40"
                            >
                              Regenerate mismatched shots
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )})}
          </ol>
          {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
        </section>}
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
