"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/types";
import { useChaplinStore } from "@/lib/store";
import MediaPlayer from "@/components/MediaPlayer";
import {
  buildProductionBible,
  buildScenePackage,
  composeIdentityImagePrompt,
  composeVoiceDesignPrompt,
  type ScenePackage,
  type ShotBlueprint,
} from "@/lib/production-prompting";

type ProductionAsset = {
  id: string;
  kind: string;
  url: string;
  provider: string;
  prompt: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProductionState = {
  voiceId: string | null;
  latestDialogueUrl: string | null;
  latestSfxUrl: string | null;
  latestThemeUrl: string | null;
  latestImageUrl: string | null;
  latestVideoUrl: string | null;
  visualReference: {
    url: string;
    assetId: string | null;
    source: "selected-cover" | "identity-asset" | "character-image" | "character-media" | "character-banner";
  } | null;
  featured: {
    voiceAssetId: string | null;
    themeAssetId: string | null;
    videoAssetId: string | null;
    coverAssetId: string | null;
  };
  assets: ProductionAsset[];
};
type ProfileSlot = "voice" | "theme" | "video" | "cover";
type ImagePurpose = "identity" | "scene";
type ProviderStatus = {
  elevenLabs: boolean;
  seedModels: boolean;
  database: boolean;
  production: ProductionState | null;
  providers: {
    elevenLabs: ProviderCheck | null;
    seedModels: ProviderCheck | null;
  } | null;
};
type ProviderCheck = {
  status: string;
  error: string | null;
  updatedAt: string;
  hasSucceeded?: boolean;
  lastSucceededAt?: string | null;
};
type VoicePreview = {
  audio_base_64: string;
  generated_voice_id: string;
  media_type?: string;
  duration_secs?: number;
};
type SfxCandidate = {
  assetId: string;
  label: string;
  direction: string;
  url: string;
};
type QuickWriteField =
  | "voice-description"
  | "voice-preview"
  | "dialogue"
  | "sfx"
  | "theme"
  | "identity-image"
  | "image"
  | "video";

const WORKFLOW_STEPS = [
  { id: 1, label: "Voice", title: "Define the voice" },
  { id: 2, label: "Dialogue", title: "Build the dialogue" },
  { id: 3, label: "SFX", title: "Add signature SFX" },
  { id: 4, label: "Theme", title: "Create the music score" },
  { id: 5, label: "Still", title: "Finalize the scene still" },
  { id: 6, label: "Video", title: "Assemble the scene" },
] as const;

const SFX_VARIATIONS = [
  { label: "Dry mark", direction: "Interpret it as an ultra-dry, close-mic tactile mark with almost no tail." },
  { label: "Material detail", direction: "Focus on one unusual material resonance that makes the actor recognizable." },
  { label: "Motion accent", direction: "Focus on a compact movement accent with a fast attack and controlled air displacement." },
  { label: "Dramatic punctuation", direction: "Focus on a restrained dramatic punctuation with a surprising micro-detail before the clean stop." },
] as const;

const SEEDANCE_ACTIVATION_URL =
  "https://console.byteplus.com/ark/region%3Aark%2Bap-southeast-1/model/detail?Id=seedance-1-5-pro";
async function errorFrom(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Generation failed with status ${response.status}.`;
}

function QuickWriteButton({
  field,
  busy,
  writing,
  onClick,
}: {
  field: QuickWriteField;
  busy: boolean;
  writing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      data-quick-write={field}
      className="shrink-0 rounded-full border border-accent/50 px-2.5 py-1 text-[10px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
    >
      {writing ? "Writing..." : "✦ Quick Write"}
    </button>
  );
}

export default function CharacterProductionStudio({ character }: { character: Character }) {
  const setCharacterVoice = useChaplinStore((s) => s.setCharacterVoice);
  const addCharacterImage = useChaplinStore((s) => s.addCharacterImage);
  const setCharacterVideo = useChaplinStore((s) => s.setCharacterVideo);
  const mergePersistedCharacters = useChaplinStore((s) => s.mergePersistedCharacters);

  const productionBible = useMemo(() => buildProductionBible(character), [character]);
  const initialScene = useMemo(() => buildScenePackage(character, 0), [character]);
  const brollLine = character.brollLine ?? character.tagline;
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [voiceDescription, setVoiceDescription] = useState(
    composeVoiceDesignPrompt(character)
  );
  const [previewText, setPreviewText] = useState(brollLine);
  const [previews, setPreviews] = useState<VoicePreview[]>([]);
  const [speechText, setSpeechText] = useState(brollLine);
  const [speechUrl, setSpeechUrl] = useState("");
  const [sfxPrompt, setSfxPrompt] = useState(
    initialScene.sfx
  );
  const [sfxUrl, setSfxUrl] = useState("");
  const [sfxCandidates, setSfxCandidates] = useState<SfxCandidate[]>([]);
  const [themePrompt, setThemePrompt] = useState(
    initialScene.theme
  );
  const [themeUrl, setThemeUrl] = useState("");
  const [imagePurpose, setImagePurpose] = useState<ImagePurpose>("identity");
  const [imagePrompt, setImagePrompt] = useState(composeIdentityImagePrompt(character));
  const [scenePrompt, setScenePrompt] = useState(
    initialScene.video
  );
  const [generatedImage, setGeneratedImage] = useState("");
  const [canonicalReferenceImage, setCanonicalReferenceImage] = useState("");
  const [generatedVideo, setGeneratedVideo] = useState("");
  const [assetHistory, setAssetHistory] = useState<ProductionAsset[]>([]);
  const [magicSceneIndex, setMagicSceneIndex] = useState(0);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [sceneBlueprint, setSceneBlueprint] = useState<ShotBlueprint>(initialScene.blueprint);
  const [busy, setBusy] = useState("");
  const [quickWriting, setQuickWriting] = useState<QuickWriteField | null>(null);
  const [selectingAsset, setSelectingAsset] = useState("");
  const [message, setMessage] = useState("");
  const referenceImage = canonicalReferenceImage || character.imageUrl || character.galleryUrls?.[0] || character.bannerUrl || "";

  useEffect(() => {
    fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`)
      .then((response) => response.json())
      .then((data: ProviderStatus) => {
        setStatus(data);
        const production = data.production;
        if (!production) return;
        setAssetHistory(production.assets ?? []);
        setCanonicalReferenceImage(production.visualReference?.url ?? "");
        if (production.voiceId && production.voiceId !== character.voiceId) {
          setCharacterVoice(character.id, production.voiceId);
        }
        if (production.latestDialogueUrl) setSpeechUrl(production.latestDialogueUrl);
        if (production.latestSfxUrl) setSfxUrl(production.latestSfxUrl);
        if (production.latestThemeUrl) setThemeUrl(production.latestThemeUrl);
        if (production.latestImageUrl) {
          setGeneratedImage(production.latestImageUrl);
          if (!character.galleryUrls?.includes(production.latestImageUrl)) {
            addCharacterImage(character.id, production.latestImageUrl);
          }
        }
        if (production.latestVideoUrl) {
          setGeneratedVideo(production.latestVideoUrl);
          if (production.latestVideoUrl !== character.videoUrl) {
            setCharacterVideo(character.id, production.latestVideoUrl);
          }
        }
      })
      .catch(() => setStatus({ elevenLabs: false, seedModels: false, database: false, production: null, providers: null }));
  }, [addCharacterImage, character.galleryUrls, character.id, character.videoUrl, character.voiceId, setCharacterVideo, setCharacterVoice]);

  async function refreshHistory() {
    const response = await fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as ProviderStatus;
    setStatus(data);
    if (data.production) {
      setAssetHistory(data.production.assets ?? []);
      setCanonicalReferenceImage(data.production.visualReference?.url ?? "");
      if (data.production.latestDialogueUrl) setSpeechUrl(data.production.latestDialogueUrl);
      if (data.production.latestThemeUrl) setThemeUrl(data.production.latestThemeUrl);
      if (data.production.latestImageUrl) setGeneratedImage(data.production.latestImageUrl);
      if (data.production.latestVideoUrl) setGeneratedVideo(data.production.latestVideoUrl);
    }
    window.dispatchEvent(new CustomEvent("chaplin:media-updated", { detail: { characterId: character.id } }));
  }

  async function selectProfileMedia(asset: ProductionAsset, slot: ProfileSlot) {
    setSelectingAsset(asset.id);
    setMessage("");
    try {
      const response = await fetch("/api/characters/profile-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, assetId: asset.id, slot }),
      });
      if (!response.ok) throw new Error(await errorFrom(response));
      await refreshHistory();
      const catalogueResponse = await fetch("/api/characters", { cache: "no-store" });
      if (catalogueResponse.ok) {
        const catalogue = await catalogueResponse.json() as { characters?: Character[] };
        if (Array.isArray(catalogue.characters)) mergePersistedCharacters(catalogue.characters);
      }
      const labels: Record<ProfileSlot, string> = {
        voice: "main profile voice",
        theme: "profile theme",
        video: "hero video",
        cover: "hero cover",
      };
      setMessage(`Selected as ${labels[slot]}. The public profile now uses this take.`);
    } catch (error) {
      setMessage(`Selection failed: ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
      setSelectingAsset("");
    }
  }

  async function ensureCharacterIsSaved() {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character, ensureOnly: true }),
    });
    if (!response.ok) throw new Error(await errorFrom(response));
  }

  async function quickWrite(
    field: QuickWriteField,
    currentText: string,
    update: (value: string) => void
  ) {
    setQuickWriting(field);
    setMessage("");
    try {
      const response = await fetch("/api/write/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          currentText,
          character,
          context: {
            voiceDescription,
            voicePreview: previewText,
            dialogue: speechText,
            sfx: sfxPrompt,
            theme: themePrompt,
            image: imagePrompt,
            video: scenePrompt,
          },
        }),
      });
      if (!response.ok) throw new Error(await errorFrom(response));
      const data = await response.json() as { text?: string; provider?: string; warning?: string };
      if (!data.text) throw new Error("Quick Write returned no text.");
      update(data.text);
      setMessage(
        data.warning || (data.provider === "anthropic"
          ? "Claude rewrote this field using the actor's complete identity."
          : "Quick Write updated this field locally.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Quick Write failed.");
    } finally {
      setQuickWriting(null);
    }
  }

  async function jsonAction(action: string, payload: Record<string, unknown>) {
    await ensureCharacterIsSaved();
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, characterId: character.id, character, ...payload }),
    });
    if (!response.ok) throw new Error(await errorFrom(response));
    return response.json();
  }

  async function audioAction(action: "speech" | "sfx" | "theme", payload: Record<string, unknown>) {
    await ensureCharacterIsSaved();
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, characterId: character.id, character, ...payload }),
    });
    if (!response.ok) throw new Error(await errorFrom(response));
    const persistentUrl = response.headers.get("X-Asset-Url");
    return persistentUrl ?? URL.createObjectURL(await response.blob());
  }

  async function generateSfxTake(prompt: string) {
    await ensureCharacterIsSaved();
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sfx", characterId: character.id, character, prompt, durationSeconds: 1.5 }),
    });
    if (!response.ok) throw new Error(await errorFrom(response));
    const url = response.headers.get("X-Asset-Url") ?? URL.createObjectURL(await response.blob());
    const assetId = response.headers.get("X-Asset-Id");
    if (!assetId) throw new Error("The generated SFX take was not attached to the actor.");
    return { assetId, url };
  }

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  }

  function designVoice() {
    void run("voice-design", async () => {
      const data = (await jsonAction("voice-design", {
        description: voiceDescription,
        previewText,
      })) as { previews: VoicePreview[] };
      setPreviews(data.previews ?? []);
      setMessage("Three original voice candidates are ready. Listen, then lock one to the actor.");
    });
  }

  function lockVoice(preview: VoicePreview) {
    void run("voice-save", async () => {
      const data = (await jsonAction("voice-save", {
        name: `${character.name} - Chaplin`,
        description: voiceDescription,
        generatedVoiceId: preview.generated_voice_id,
        characterId: character.id,
      })) as { voice_id: string; already_locked?: boolean };
      setCharacterVoice(character.id, data.voice_id);
      setPreviews([]);
      setMessage(
        data.already_locked
          ? `${character.name}'s voice was already locked. It is ready for dialogue.`
          : `Voice locked to ${character.name}. Every future line can now use the same voice ID.`
      );
    });
  }

  function generateSpeech() {
    if (!character.voiceId) {
      setMessage("Design and lock a voice before generating dialogue.");
      return;
    }
    void run("speech", async () => {
      setSpeechUrl(await audioAction("speech", { speechText }));
      await refreshHistory();
      setMessage("Dialogue generated from the server-verified locked voice in continuity mode.");
    });
  }

  function generateSfx() {
    void run("sfx", async () => {
      setSfxCandidates([]);
      const candidates: SfxCandidate[] = [];
      for (const variation of SFX_VARIATIONS) {
        const candidatePrompt = `${sfxPrompt} ${variation.direction} Total duration 1.5 seconds.`;
        const generated = await generateSfxTake(candidatePrompt);
        candidates.push({ ...variation, ...generated });
        setSfxCandidates([...candidates]);
      }
      if (candidates[0]) {
        await jsonAction("sfx-select", { assetId: candidates[0].assetId });
        setSfxUrl(candidates[0].url);
      }
      await refreshHistory();
      setMessage("Four short character-specific SFX takes are ready. Preview them and choose the strongest signature.");
    });
  }

  function selectSfxCandidate(candidate: SfxCandidate) {
    void run("sfx-select", async () => {
      await jsonAction("sfx-select", { assetId: candidate.assetId });
      setSfxUrl(candidate.url);
      await refreshHistory();
      window.dispatchEvent(new CustomEvent("chaplin:media-updated", { detail: { characterId: character.id } }));
      setMessage(`${candidate.label} is now ${character.name}'s reusable signature SFX.`);
    });
  }

  function generateTheme() {
    void run("theme", async () => {
      setThemeUrl(await audioAction("theme", { prompt: themePrompt }));
      await refreshHistory();
      setMessage("The actor theme was generated, archived to the CDN, and added to the public Sound Profile.");
    });
  }

  function generateImage() {
    void run("image", async () => {
      const data = (await jsonAction("image", {
        prompt: imagePrompt,
        imagePurpose,
        referenceImage,
      })) as { url: string };
      setGeneratedImage(data.url);
      addCharacterImage(character.id, data.url);
      await refreshHistory();
      setMessage(imagePurpose === "identity"
        ? "Identity hero generated from the actor's canonical visual seed. Review it, then set it as the hero cover if it should become the new identity reference."
        : "Scene frame generated from the actor's visual reference and added to the gallery. It is now ready for Seedance.");
    });
  }

  function uploadReferenceImage(file: File) {
    void run("upload", async () => {
      await ensureCharacterIsSaved();
      const form = new FormData();
      form.set("characterId", character.id);
      form.set("character", JSON.stringify(character));
      form.set("kind", "gallery");
      form.set("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error(await errorFrom(response));
      const data = (await response.json()) as { id: string; url: string };
      const selectResponse = await fetch("/api/characters/profile-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, assetId: data.id, slot: "cover" }),
      });
      if (!selectResponse.ok) throw new Error(await errorFrom(selectResponse));
      setGeneratedImage(data.url);
      setCanonicalReferenceImage(data.url);
      if (!character.galleryUrls?.includes(data.url)) addCharacterImage(character.id, data.url);
      await refreshHistory();
      setMessage("Reference image uploaded and locked as this actor's canonical visual seed for every future still and video.");
    });
  }

  function generateVideo() {
    void run("video", async () => {
      const data = (await jsonAction("video", { prompt: scenePrompt, referenceImage })) as { url: string };
      setGeneratedVideo(data.url);
      setCharacterVideo(character.id, data.url);
      await refreshHistory();
      setMessage("Five-second Seedance clip generated and attached to the actor profile.");
    });
  }

  function applyScenePackage(scene: ScenePackage) {
    setSpeechText(scene.dialogue);
    setSfxPrompt(scene.sfx);
    setThemePrompt(scene.theme);
    setImagePrompt(scene.image);
    setImagePurpose("scene");
    setScenePrompt(scene.video);
    setSceneBlueprint(scene.blueprint);
  }

  function chooseImagePurpose(purpose: ImagePurpose) {
    setImagePurpose(purpose);
    setImagePrompt(purpose === "identity"
      ? composeIdentityImagePrompt(character)
      : buildScenePackage(character, magicSceneIndex).image);
  }

  function applyMagicScene() {
    const nextIndex = magicSceneIndex + 1;
    setMagicSceneIndex(nextIndex);
    void run("magic-scene", async () => {
      const response = await fetch("/api/write/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: { ...character, productionBible }, variation: nextIndex }),
      });
      if (!response.ok) throw new Error(await errorFrom(response));
      const data = await response.json() as { scene?: ScenePackage; provider?: string; warning?: string };
      if (!data.scene) throw new Error("Magic Scene returned no directed scene.");
      applyScenePackage(data.scene);
      setMessage(data.warning || `Magic Scene directed: ${data.scene.sceneName}. Each medium now has its own production instructions.`);
    });
  }

  const seedModelsReady = status?.seedModels ?? false;
  const elevenReady = status?.elevenLabs ?? false;
  const elevenOperational =
    status?.providers?.elevenLabs?.status === "succeeded" ||
    status?.providers?.elevenLabs?.hasSucceeded === true;
  const seedModelsFailed = status?.providers?.seedModels?.status === "failed";
  const seedModelsNeedActivation =
    seedModelsFailed && /not activated|activate the model/i.test(status?.providers?.seedModels?.error ?? "");
  const activeStepMeta = WORKFLOW_STEPS.find((step) => step.id === activeStep) ?? WORKFLOW_STEPS[0];
  const completedSteps = new Set<number>([
    ...(character.voiceId ? [1] : []),
    ...(speechUrl ? [2] : []),
    ...(sfxUrl ? [3] : []),
    ...(themeUrl ? [4] : []),
    ...(generatedImage || referenceImage ? [5] : []),
    ...(generatedVideo || character.videoUrl ? [6] : []),
  ]);

  return (
    <section className="overflow-hidden" data-production-workflow>
      <div className="p-5 sm:p-6 border-b border-line bg-accent/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
              AI actor production pipeline
            </p>
            <h2 className="reel-title text-2xl">Make {character.name} perform</h2>
            <p className="text-xs text-grey mt-1 max-w-xl">
              One identity feeds every voice line, signature sound, still, and five-second scene.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
            <span className={`rounded-full border px-2 py-1 ${elevenOperational ? "border-emerald-500 text-emerald-600" : elevenReady ? "border-amber-400 text-amber-400" : "border-line text-grey"}`}>
              ElevenLabs {elevenOperational ? "operational" : elevenReady ? "configured" : "needs key"}
            </span>
            <span className={`rounded-full border px-2 py-1 ${seedModelsFailed ? "border-red-500 text-red-500" : seedModelsReady ? "border-amber-400 text-amber-400" : "border-line text-grey"}`}>
              Seed models {seedModelsNeedActivation ? "activation required" : seedModelsFailed ? "last run failed" : seedModelsReady ? "ModelArk configured" : "needs Seed API key"}
            </span>
            <span className={`rounded-full border px-2 py-1 ${status?.database ? "border-emerald-500 text-emerald-600" : "border-line text-grey"}`}>
              Database {status?.database ? "ready" : "needs Supabase"}
            </span>
          </div>
        </div>
        <div className="mt-5 flex gap-1 overflow-x-auto pb-1 no-scrollbar" aria-label="Production workflow steps">
          {WORKFLOW_STEPS.map((step) => {
            const isActive = step.id === activeStep;
            const isComplete = completedSteps.has(step.id);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex min-w-24 shrink-0 items-center gap-2 border-b-2 px-2.5 py-2 text-left transition-colors sm:min-w-28 ${isActive ? "border-accent text-ink" : "border-transparent text-grey hover:text-ink"}`}
                aria-current={isActive ? "step" : undefined}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold ${isComplete ? "border-accent-secondary bg-accent-secondary text-paper" : isActive ? "border-accent text-accent" : "border-line"}`}>{isComplete ? "✓" : step.id}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-6">
        {seedModelsNeedActivation && (
          <div className="rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-500">Seedance 1.5 Pro needs account activation</p>
              <p className="text-xs text-grey mt-1">
                The API key is valid, but BytePlus is refusing video jobs until this model is enabled for the account. Image, voice, SFX, and CDN uploads remain operational.
              </p>
            </div>
            <a
              href={SEEDANCE_ACTIVATION_URL}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full border border-amber-500 px-4 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10"
            >
              Activate Seedance ↗
            </a>
          </div>
        )}
        <details className="rounded-md border border-line bg-paper/30 p-4" data-production-bible>
          <summary className="cursor-pointer text-sm font-semibold">Actor Direction Bible</summary>
          <p className="mt-1 text-[11px] text-grey">Persistent canon used by every scene and story—not copied into every provider prompt.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <p><span className="text-grey">Want:</span> {productionBible.dramatic.externalWant}</p>
            <p><span className="text-grey">Contradiction:</span> {productionBible.dramatic.contradiction}</p>
            <p><span className="text-grey">Under pressure:</span> {productionBible.performance.underPressure}</p>
            <p><span className="text-grey">Movement:</span> {productionBible.performance.movementStyle}</p>
            <p><span className="text-grey">Face locks:</span> {productionBible.visual.faceAnchors.join("; ")}</p>
            <p><span className="text-grey">Story hook:</span> {productionBible.story.hookPattern}</p>
          </div>
        </details>
        <div className="rounded-md border border-accent/40 bg-accent/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Quick scene change</p>
              {magicSceneIndex >= 0 && (
                <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent">
                  {sceneBlueprint.sceneName}
                </span>
              )}
            </div>
            <p className="text-xs text-grey mt-1">
              AI directs one playable beat, then writes separate instructions for dialogue, SFX, music, the first frame, and image-to-video motion.
            </p>
          </div>
          <button
            type="button"
            onClick={applyMagicScene}
            disabled={Boolean(busy)}
            data-action="magic-scene"
            className="shrink-0 rounded-full bg-accent text-paper px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {busy === "magic-scene" ? "Directing scene..." : "✦ Magic Scene"}
          </button>
        </div>
        <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Step {activeStepMeta.id} of {WORKFLOW_STEPS.length}</p>
            <h3 className="reel-title mt-1 text-2xl">{activeStepMeta.title}</h3>
          </div>
          <span className="hidden text-right text-[11px] text-grey sm:block">Your actor’s identity remains connected through every stage.</span>
        </div>
        <details className="rounded-md border border-line bg-paper/40 p-4" data-scene-blueprint>
          <summary className="cursor-pointer text-sm font-semibold">Director blueprint · {sceneBlueprint.sceneName}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <p><span className="text-grey">Hook:</span> {sceneBlueprint.hook}</p>
            <p><span className="text-grey">Dramatic beat:</span> {sceneBlueprint.dramaticBeat}</p>
            <p><span className="text-grey">Angle / lens:</span> {sceneBlueprint.cameraAngle}; {sceneBlueprint.lens}</p>
            <p><span className="text-grey">Camera path:</span> {sceneBlueprint.cameraMovement}</p>
            <p><span className="text-grey">Key light:</span> {sceneBlueprint.keyLight}</p>
            <p><span className="text-grey">Final frame:</span> {sceneBlueprint.finalFrame}</p>
          </div>
        </details>
        <div className="grid gap-5">
          <div className={`border border-line rounded-md p-4 flex flex-col gap-3 ${activeStep === 1 ? "" : "hidden"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">1. Unique voice identity</h3>
              {character.voiceId && <span className="text-[10px] text-emerald-600 uppercase">Voice locked</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-grey">Voice design prompt</span>
                <QuickWriteButton
                  field="voice-description"
                  busy={Boolean(busy) || Boolean(quickWriting)}
                  writing={quickWriting === "voice-description"}
                  onClick={() => void quickWrite("voice-description", voiceDescription, setVoiceDescription)}
                />
              </div>
              <textarea value={voiceDescription} onChange={(event) => setVoiceDescription(event.target.value)} rows={4} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-grey">Voice performance sample</span>
                <QuickWriteButton
                  field="voice-preview"
                  busy={Boolean(busy) || Boolean(quickWriting)}
                  writing={quickWriting === "voice-preview"}
                  onClick={() => void quickWrite("voice-preview", previewText, setPreviewText)}
                />
              </div>
              <textarea value={previewText} onChange={(event) => setPreviewText(event.target.value)} rows={3} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            </div>
            <button onClick={designVoice} disabled={!elevenReady || Boolean(busy)} className="bg-accent text-paper rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "voice-design" ? "Designing three voices..." : "Design voice candidates"}
            </button>
            {previews.map((preview, index) => (
              <div key={preview.generated_voice_id} className="border border-line rounded-sm p-2 flex items-center gap-2">
                <span className="text-[10px] text-grey w-12">Take {index + 1}</span>
                <div className="flex-1 min-w-0">
                  <MediaPlayer
                    src={`data:${preview.media_type ?? "audio/mpeg"};base64,${preview.audio_base_64}`}
                    label={`Voice candidate ${index + 1}`}
                    compact
                  />
                </div>
                <button onClick={() => lockVoice(preview)} disabled={Boolean(busy)} className="text-xs text-accent font-semibold disabled:opacity-40">
                  {busy === "voice-save" ? "Locking..." : "Lock"}
                </button>
              </div>
            ))}
          </div>

          <div className={`border border-line rounded-md p-4 flex flex-col gap-3 ${activeStep === 2 ? "" : "hidden"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">2. Dialogue in the locked voice</h3>
              <QuickWriteButton
                field="dialogue"
                busy={Boolean(busy) || Boolean(quickWriting)}
                writing={quickWriting === "dialogue"}
                onClick={() => void quickWrite("dialogue", speechText, setSpeechText)}
              />
            </div>
            <textarea data-scene-field="dialogue" value={speechText} onChange={(event) => setSpeechText(event.target.value)} rows={5} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            <button onClick={generateSpeech} disabled={!elevenReady || Boolean(busy) || !character.voiceId} className="border border-accent text-accent rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "speech" ? "Performing line..." : "Generate dialogue"}
            </button>
            {character.voiceId && (
              <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-600">
                Locked voice · {character.voiceId.slice(-6)} · continuity mode
              </p>
            )}
            {speechUrl ? <MediaPlayer src={speechUrl} label={`${character.name} dialogue`} compact /> : <p className="text-xs text-grey">Lock one voice once; reuse it across every story and language.</p>}
          </div>
        </div>

        <div className={`border border-line rounded-md p-4 flex flex-col gap-3 ${activeStep === 3 ? "" : "hidden"}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">3. Signature SFX</h3>
            <QuickWriteButton
              field="sfx"
              busy={Boolean(busy) || Boolean(quickWriting)}
              writing={quickWriting === "sfx"}
              onClick={() => void quickWrite("sfx", sfxPrompt, setSfxPrompt)}
            />
          </div>
          <input data-scene-field="sfx" value={sfxPrompt} onChange={(event) => setSfxPrompt(event.target.value)} className="bg-paper border border-line rounded-sm p-3 text-xs focus:outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={generateSfx} disabled={!elevenReady || Boolean(busy)} className="border border-accent text-accent rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "sfx" ? `Creating take ${Math.min(sfxCandidates.length + 1, 4)} of 4...` : "Generate 4 short SFX takes"}
            </button>
            <span className="text-[10px] uppercase tracking-[0.14em] text-grey">1.5 seconds each</span>
          </div>
          {sfxCandidates.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2" data-sfx-candidates>
              {sfxCandidates.map((candidate, index) => {
                const selected = sfxUrl === candidate.url;
                return (
                  <div key={candidate.url} className={`rounded-sm border p-3 ${selected ? "border-accent bg-accent/5" : "border-line"}`} data-sfx-candidate={index + 1}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Take {index + 1} · {candidate.label}</span>
                      <button
                        type="button"
                        onClick={() => selectSfxCandidate(candidate)}
                        disabled={Boolean(busy)}
                        className={`text-[10px] font-semibold ${selected ? "text-emerald-500" : "text-accent hover:underline"}`}
                      >
                        {busy === "sfx-select" && !selected ? "Selecting..." : selected ? "Selected ✓" : "Use this take"}
                      </button>
                    </div>
                    <MediaPlayer src={candidate.url} label={`${character.name} SFX take ${index + 1}`} compact />
                  </div>
                );
              })}
            </div>
          ) : sfxUrl ? (
            <MediaPlayer src={sfxUrl} label={`${character.name} signature SFX`} compact />
          ) : (
            <p className="text-xs text-grey">Generate four distinct short reads, then select the one that best identifies the actor.</p>
          )}
        </div>

        <div className={`border border-line rounded-md p-4 flex flex-col gap-3 ${activeStep === 4 ? "" : "hidden"}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">4. Theme score</h3>
            <QuickWriteButton
              field="theme"
              busy={Boolean(busy) || Boolean(quickWriting)}
              writing={quickWriting === "theme"}
              onClick={() => void quickWrite("theme", themePrompt, setThemePrompt)}
            />
          </div>
          <input data-scene-field="theme" value={themePrompt} onChange={(event) => setThemePrompt(event.target.value)} className="bg-paper border border-line rounded-sm p-3 text-xs focus:outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={generateTheme} disabled={!elevenReady || Boolean(busy)} className="border border-accent text-accent rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "theme" ? "Composing theme..." : "Generate 12-second theme"}
            </button>
            {themeUrl && <div className="flex-1 min-w-64"><MediaPlayer src={themeUrl} label={`${character.name} theme`} compact /></div>}
          </div>
        </div>

        <div className="grid gap-5">
          <div className={`border border-line rounded-md p-4 flex flex-col gap-3 ${activeStep === 5 ? "" : "hidden"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">5. Define the actor on screen</h3>
              <QuickWriteButton
                field={imagePurpose === "identity" ? "identity-image" : "image"}
                busy={Boolean(busy) || Boolean(quickWriting)}
                writing={quickWriting === (imagePurpose === "identity" ? "identity-image" : "image")}
                onClick={() => void quickWrite(imagePurpose === "identity" ? "identity-image" : "image", imagePrompt, setImagePrompt)}
              />
            </div>
            <div className="grid grid-cols-2 rounded-md border border-line p-1" data-image-purpose>
              <button
                type="button"
                onClick={() => chooseImagePurpose("identity")}
                className={`rounded-sm px-3 py-2 text-left ${imagePurpose === "identity" ? "bg-accent text-paper" : "text-grey hover:text-ink"}`}
                data-image-purpose-option="identity"
              >
                <span className="block text-xs font-semibold">Identity Hero</span>
                <span className="block text-[10px] opacity-75">Who this actor is</span>
              </button>
              <button
                type="button"
                onClick={() => chooseImagePurpose("scene")}
                className={`rounded-sm px-3 py-2 text-left ${imagePurpose === "scene" ? "bg-accent text-paper" : "text-grey hover:text-ink"}`}
                data-image-purpose-option="scene"
              >
                <span className="block text-xs font-semibold">Scene Frame</span>
                <span className="block text-[10px] opacity-75">What happens next</span>
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-grey">
              {imagePurpose === "identity"
                ? `Create the definitive casting image: a repeatable face, silhouette, wardrobe, expression, world, lens, and motivated light derived from the actor's personality.${referenceImage ? " The locked identity seed below remains the basis for the person." : " This first accepted image will become the actor's visual seed."}`
                : `Create a story frame from the selected identity reference${referenceImage ? " shown in the video panel" : "—choose or upload an identity image first"}. The face and wardrobe stay locked while only the dramatic moment changes.`}
            </p>
            {referenceImage && (
              <div className="flex items-center gap-3 rounded-sm border border-accent/50 bg-accent/5 p-2" data-identity-reference>
                {/* eslint-disable-next-line @next/next/no-img-element -- generated and uploaded provider URLs are dynamic */}
                <img src={referenceImage} alt={`${character.name} canonical identity seed`} className="h-14 w-20 shrink-0 rounded-sm object-cover" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Identity seed locked</span>
                  <span className="mt-1 block text-[10px] leading-snug text-grey">Every Seedream still and Seedance video preserves this face, age, hair, proportions, and signature wardrobe.</span>
                </span>
              </div>
            )}
            <textarea data-scene-field="image" value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={7} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            <button onClick={generateImage} disabled={!seedModelsReady || Boolean(busy)} className="bg-accent text-paper rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "image" ? "Seedream is creating..." : imagePurpose === "identity" ? "Generate identity hero" : "Generate scene frame"}
            </button>
            <div className="flex items-center gap-2">
              <span className="h-px bg-line flex-1" />
              <span className="text-[10px] uppercase tracking-wide text-grey">or use your own</span>
              <span className="h-px bg-line flex-1" />
            </div>
            <label className={`border border-dashed border-line hover:border-accent rounded-sm px-4 py-3 text-center text-xs cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>
              {busy === "upload" ? "Uploading to CDN..." : "Upload PNG, JPEG, or WebP reference"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadReferenceImage(file);
                  event.target.value = "";
                }}
              />
            </label>
            {generatedImage && (
              // eslint-disable-next-line @next/next/no-img-element -- provider URLs are dynamic and short-lived
              <img src={generatedImage} alt={`Generated ${character.name} scene`} className="w-full rounded-sm aspect-video object-cover" />
            )}
          </div>

          <div className={`border border-line rounded-md p-4 flex flex-col gap-3 ${activeStep === 6 ? "" : "hidden"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">6. Animate a five-second scene</h3>
              <QuickWriteButton
                field="video"
                busy={Boolean(busy) || Boolean(quickWriting)}
                writing={quickWriting === "video"}
                onClick={() => void quickWrite("video", scenePrompt, setScenePrompt)}
              />
            </div>
            {referenceImage && (
              <div className="relative overflow-hidden rounded-sm border border-line" data-video-reference>
                {/* eslint-disable-next-line @next/next/no-img-element -- generated and uploaded provider URLs are dynamic */}
                <img src={referenceImage} alt="Selected exact first frame" className="aspect-video w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[9px] uppercase tracking-wide text-white">Exact first frame</span>
              </div>
            )}
            <textarea data-scene-field="video" value={scenePrompt} onChange={(event) => setScenePrompt(event.target.value)} rows={7} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            <button onClick={generateVideo} disabled={!seedModelsReady || Boolean(busy)} className="bg-accent text-paper rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "video" ? "Seedance is rendering..." : "Generate 5-second video"}
            </button>
            <p className="text-[11px] text-grey">Seedance uses the selected still as the exact first frame. This prompt controls only performance, camera, light continuity, environmental motion, and the final frame; locked voice, SFX, and music stay separate.</p>
            {(generatedVideo || character.videoUrl) && <MediaPlayer src={generatedVideo || character.videoUrl || ""} label={`${character.name} scene`} kind="video" />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <button type="button" onClick={() => setActiveStep((current) => Math.max(1, current - 1))} disabled={activeStep === 1} className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-grey hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">← Back</button>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-grey">{completedSteps.has(activeStep) ? "Stage complete" : "Keep shaping the take"}</p>
            {activeStep < WORKFLOW_STEPS.length ? (
              <button type="button" onClick={() => setActiveStep((current) => Math.min(WORKFLOW_STEPS.length, current + 1))} className="mt-1 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper hover:opacity-90">Continue to {WORKFLOW_STEPS[activeStep].label} →</button>
            ) : (
              <a href="#generated-scene-log" className="mt-1 inline-block rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper hover:opacity-90">Review outputs ↓</a>
            )}
          </div>
        </div>

        <details id="generated-scene-log" data-generation-history className="border border-line rounded-md overflow-hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-white/[0.03]">Generated Scene Log · {assetHistory.length} saved assets</summary>
          <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2 bg-white/[0.02]">
            <div>
              <h3 className="font-semibold text-sm">Generated Scene Log</h3>
              <p className="text-[11px] text-grey mt-0.5">Persistent outputs from Supabase. Replay any take or reopen its original prompt.</p>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-grey">{assetHistory.length} saved assets</span>
          </div>
          {assetHistory.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-grey">Generated dialogue, sounds, stills, and videos will appear here.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3 p-3">
              {assetHistory.slice(0, 12).map((asset) => {
                const label = asset.kind === "dialogue"
                  ? "Dialogue take"
                  : asset.kind === "sfx"
                    ? "Signature SFX"
                    : asset.kind === "theme"
                      ? "Theme score"
                      : asset.kind === "video"
                        ? "Generated scene"
                        : "Scene still";
                const profileOption: { slot: ProfileSlot; label: string } | null = asset.kind === "dialogue"
                  ? { slot: "voice", label: "Use as main profile voice" }
                  : asset.kind === "theme"
                    ? { slot: "theme", label: "Use as profile theme" }
                    : asset.kind === "video"
                      ? { slot: "video", label: "Use as hero video" }
                      : ["gallery", "avatar", "banner"].includes(asset.kind)
                        ? { slot: "cover", label: "Use as hero cover" }
                        : null;
                const featuredIds = status?.production?.featured;
                const selectedAssetId = profileOption?.slot === "voice"
                  ? featuredIds?.voiceAssetId
                  : profileOption?.slot === "theme"
                    ? featuredIds?.themeAssetId
                    : profileOption?.slot === "video"
                      ? featuredIds?.videoAssetId
                      : profileOption?.slot === "cover"
                        ? featuredIds?.coverAssetId
                        : null;
                const isFeatured = selectedAssetId === asset.id;
                return (
                  <article key={asset.id} className={`rounded-md border bg-black/10 p-3 min-w-0 ${isFeatured ? "border-accent shadow-[0_0_0_1px_rgba(244,72,112,0.35)]" : "border-line"}`} data-media-asset={asset.kind} data-featured={isFeatured ? "true" : "false"}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[10px] text-grey mt-0.5 truncate">
                          {asset.provider} · {new Date(asset.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <a href={asset.url} target="_blank" rel="noreferrer" className="text-[10px] text-accent hover:underline whitespace-nowrap">CDN ↗</a>
                    </div>
                    {asset.kind === "video" ? (
                      <MediaPlayer src={asset.url} label={label} kind="video" compact />
                    ) : ["dialogue", "sfx", "theme"].includes(asset.kind) ? (
                      <MediaPlayer src={asset.url} label={label} compact />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- generated CDN URLs are dynamic
                      <img src={asset.url} alt={`${character.name} generated still`} loading="lazy" className="w-full aspect-video object-cover rounded-sm border border-line" />
                    )}
                    {profileOption && (
                      <details className="relative mt-3" data-profile-media-menu>
                        <summary className="cursor-pointer list-none rounded-sm border border-accent/60 px-3 py-2 text-center text-[11px] font-semibold text-accent hover:bg-accent/10">
                          {isFeatured ? "On profile âœ“" : "Set as..."}
                        </summary>
                        <div className="mt-2 rounded-sm border border-line bg-paper p-2 shadow-xl">
                          <button
                            type="button"
                            onClick={() => void selectProfileMedia(asset, profileOption.slot)}
                            disabled={isFeatured || Boolean(selectingAsset)}
                            className="w-full rounded-sm bg-accent px-3 py-2 text-left text-xs font-semibold text-paper disabled:opacity-50"
                            data-select-profile-slot={profileOption.slot}
                          >
                            {selectingAsset === asset.id ? "Selecting..." : profileOption.label}
                          </button>
                          <p className="mt-2 px-1 text-[10px] leading-relaxed text-grey">
                            This becomes the default {profileOption.slot} shown on the public actor profile and connected hero surfaces.
                          </p>
                        </div>
                      </details>
                    )}
                    {asset.prompt && (
                      <details className="mt-3 border-t border-line pt-2">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-grey hover:text-accent">Original prompt</summary>
                        <p className="text-[11px] leading-relaxed mt-2 text-grey break-words">{asset.prompt}</p>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </details>

        {message && <p className={`text-xs rounded-sm px-3 py-2 ${message.toLowerCase().includes("failed") || message.includes("not configured") ? "bg-red-500/10 text-red-600" : "bg-accent/10 text-ink"}`}>{message}</p>}
      </div>
    </section>
  );
}
