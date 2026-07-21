"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/types";
import { useChaplinStore } from "@/lib/store";
import MediaPlayer from "@/components/MediaPlayer";

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
  assets: ProductionAsset[];
};
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
type MagicScene = {
  name: string;
  line: string;
  still: string;
  motion: string;
  sound: string;
};

const SEEDANCE_ACTIVATION_URL =
  "https://console.byteplus.com/ark/region%3Aark%2Bap-southeast-1/model/detail?Id=seedance-1-5-pro";
const MAGIC_LINE_ENDINGS = ["Move.", "Now.", "Watch closely.", "Remember that."];
const MAGIC_SCENES: MagicScene[] = [
  {
    name: "Midnight Escape",
    line: "You brought the guards. I brought an exit. Keep up—the doors close in five seconds.",
    still: "inside a shadowy old cinema projection booth at night, turning toward camera with alert confidence as dust catches the projector beam",
    motion: "A hidden glass panel slides open. The character turns sharply toward camera, gives a knowing half-smile, and steps toward the escape route as the camera makes a slow controlled push-in.",
    sound: "A glass mechanism slides open, followed by a restrained projector hum and one decisive footstep.",
  },
  {
    name: "Monsoon Rendezvous",
    line: "You came alone. Good. That means we still have a chance to leave before the last train.",
    still: "beneath an old railway canopy during monsoon rain, waiting beside a brass station clock with wet reflections across the platform",
    motion: "Rain sweeps across the empty platform. The character looks up from the station clock, meets the camera, and takes one measured step forward while the last train glows in the distance.",
    sound: "Monsoon rain on a metal canopy, a distant train brake, and a soft clock mechanism.",
  },
  {
    name: "Rooftop Signal",
    line: "Look at the city. Everyone is hiding something. Tonight, we decide what survives.",
    still: "on a moonlit Lucknow rooftop above the old city, holding a small signal lamp while fabric moves in the night wind",
    motion: "The signal lamp flickers on. The character crosses the rooftop into moonlight, turns toward camera, and raises the lamp as the skyline falls softly out of focus.",
    sound: "A match strike, a low night wind, distant city ambience, and one soft signal bell.",
  },
  {
    name: "Gallery Switch",
    line: "The original was never in that case. But thank you for showing me who wanted it.",
    still: "in a grand museum corridor after hours, standing beside an open display case under pools of warm security light",
    motion: "A security light sweeps across the corridor. The character closes an empty display case, reveals a concealed object with a subtle gesture, and walks past camera without breaking composure.",
    sound: "A display latch clicks shut, a quiet security scanner passes, and footsteps recede across polished stone.",
  },
];

const VOICE_PRESENTATION = {
  feminine: "An adult woman with a clearly feminine vocal identity and natural feminine resonance",
  masculine: "An adult man with a clearly masculine vocal identity and natural masculine resonance",
  androgynous: "An adult with a deliberately androgynous vocal identity",
} as const;

async function errorFrom(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Generation failed with status ${response.status}.`;
}

export default function CharacterProductionStudio({ character }: { character: Character }) {
  const setCharacterVoice = useChaplinStore((s) => s.setCharacterVoice);
  const addCharacterImage = useChaplinStore((s) => s.addCharacterImage);
  const setCharacterVideo = useChaplinStore((s) => s.setCharacterVideo);

  const identity = useMemo(
    () =>
      `${character.name} is a fictional ${character.archetype}. ${character.personality} ` +
      `Keep the same face, age, wardrobe language, voice identity, and cinematic world in every generation.`,
    [character]
  );
  const brollLine = character.brollLine ?? character.tagline;
  const brollScene = character.brollScene ?? `in a cinematic setting that expresses ${character.personality.toLowerCase()}`;
  const subjectPronoun = character.voiceGender === "feminine" ? "she" : character.voiceGender === "masculine" ? "he" : "they";
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [voiceDescription, setVoiceDescription] = useState(
    `${VOICE_PRESENTATION[character.voiceGender ?? "androgynous"]}. ${character.voiceDesc}. Indian English with natural Hindi and Urdu pronunciation, emotionally controlled, unmistakable and repeatable. This is an original fictional voice, not an imitation of a real person.`
  );
  const [previewText, setPreviewText] = useState(brollLine);
  const [previews, setPreviews] = useState<VoicePreview[]>([]);
  const [speechText, setSpeechText] = useState(brollLine);
  const [speechUrl, setSpeechUrl] = useState("");
  const [sfxPrompt, setSfxPrompt] = useState(
    `${character.sfxDesc}. A distinctive five-second cinematic signature for ${character.name}; clean foreground effect, subtle room tone, no speech.`
  );
  const [sfxUrl, setSfxUrl] = useState("");
  const [themePrompt, setThemePrompt] = useState(
    `${character.themeDesc}. A distinctive 12-second instrumental character theme for ${character.name}; cinematic, memorable, no vocals, clean ending.`
  );
  const [themeUrl, setThemeUrl] = useState("");
  const [imagePrompt, setImagePrompt] = useState(
    `${identity} Cinematic 16:9 production still: ${brollScene}. ${subjectPronoun} turns toward camera in character, practical motivated lighting, fine film grain, realistic skin and fabric, no text, no watermark.`
  );
  const [scenePrompt, setScenePrompt] = useState(
    `${identity} Five-second cinematic visual performance: ${brollScene}. ${subjectPronoun} turns toward camera and silently performs one short punchline for later dubbing. Slow controlled push-in, natural fabric movement, strong final look to camera. Silent performance plate only: no speech, no generated voice, no vocals, no subtitles, no text, no watermark. Dialogue will be supplied separately using ${character.name}'s locked ElevenLabs voice.`
  );
  const [generatedImage, setGeneratedImage] = useState("");
  const [generatedVideo, setGeneratedVideo] = useState("");
  const [assetHistory, setAssetHistory] = useState<ProductionAsset[]>([]);
  const [magicSceneIndex, setMagicSceneIndex] = useState(-1);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`)
      .then((response) => response.json())
      .then((data: ProviderStatus) => {
        setStatus(data);
        const production = data.production;
        if (!production) return;
        setAssetHistory(production.assets ?? []);
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
    if (data.production?.assets) setAssetHistory(data.production.assets);
    window.dispatchEvent(new CustomEvent("chaplin:media-updated", { detail: { characterId: character.id } }));
  }

  async function jsonAction(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, characterId: character.id, character, ...payload }),
    });
    if (!response.ok) throw new Error(await errorFrom(response));
    return response.json();
  }

  async function audioAction(action: "speech" | "sfx" | "theme", payload: Record<string, unknown>) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, characterId: character.id, character, ...payload }),
    });
    if (!response.ok) throw new Error(await errorFrom(response));
    const persistentUrl = response.headers.get("X-Asset-Url");
    return persistentUrl ?? URL.createObjectURL(await response.blob());
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
      setSfxUrl(await audioAction("sfx", { prompt: sfxPrompt }));
      await refreshHistory();
      setMessage("A fresh version of the actor's signature sound is ready.");
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
      const data = (await jsonAction("image", { prompt: imagePrompt })) as { url: string };
      setGeneratedImage(data.url);
      addCharacterImage(character.id, data.url);
      await refreshHistory();
      setMessage("Still generated and added to the actor gallery. It is now the video reference frame.");
    });
  }

  function uploadReferenceImage(file: File) {
    void run("upload", async () => {
      const form = new FormData();
      form.set("characterId", character.id);
      form.set("character", JSON.stringify(character));
      form.set("kind", "gallery");
      form.set("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error(await errorFrom(response));
      const data = (await response.json()) as { url: string };
      setGeneratedImage(data.url);
      if (!character.galleryUrls?.includes(data.url)) addCharacterImage(character.id, data.url);
      await refreshHistory();
      setMessage("Reference image uploaded to the Supabase CDN and selected for Seedance.");
    });
  }

  function generateVideo() {
    void run("video", async () => {
      const referenceImage =
        generatedImage || character.galleryUrls?.[0] || character.bannerUrl || character.imageUrl || "";
      const data = (await jsonAction("video", { prompt: scenePrompt, referenceImage })) as { url: string };
      setGeneratedVideo(data.url);
      setCharacterVideo(character.id, data.url);
      await refreshHistory();
      setMessage("Five-second Seedance clip generated and attached to the actor profile.");
    });
  }

  function applyMagicScene() {
    const nextIndex = (magicSceneIndex + 1) % MAGIC_SCENES.length;
    const scene = MAGIC_SCENES[nextIndex];
    setMagicSceneIndex(nextIndex);
    const characterLine = character.brollLine
      ? `${character.brollLine} ${MAGIC_LINE_ENDINGS[nextIndex]}`
      : scene.line;
    setSpeechText(characterLine);
    setSfxPrompt(
      `${scene.sound} Preserve ${character.name}'s signature sound: ${character.sfxDesc}. Five seconds, clean foreground mix, no speech.`
    );
    setThemePrompt(
      `${character.themeDesc}. A 12-second instrumental score for the scene "${scene.name}" starring ${character.name}; cinematic, emotionally specific, memorable motif, no vocals, clean ending.`
    );
    setImagePrompt(
      `${identity} Cinematic 16:9 production still: ${scene.still}. Realistic skin and fabric, expressive natural pose, practical lighting, fine film grain, no text, no watermark.`
    );
    setScenePrompt(
      `${identity} Five-second cinematic visual performance. ${scene.motion} ${character.name} silently performs a short punchline for later dubbing. Silent performance plate only: no speech, no generated voice, no vocals, no subtitles, no text, no watermark. The final mix will use locked dialogue "${characterLine}", signature sound ${character.sfxDesc.toLowerCase()}, and score language ${character.themeDesc.toLowerCase()}.`
    );
    setMessage(`Magic Scene loaded: ${scene.name}. Review the coordinated prompts, then generate the assets you need.`);
  }

  const seedModelsReady = status?.seedModels ?? false;
  const elevenReady = status?.elevenLabs ?? false;
  const elevenOperational =
    status?.providers?.elevenLabs?.status === "succeeded" ||
    status?.providers?.elevenLabs?.hasSucceeded === true;
  const seedModelsFailed = status?.providers?.seedModels?.status === "failed";
  const seedModelsNeedActivation =
    seedModelsFailed && /not activated|activate the model/i.test(status?.providers?.seedModels?.error ?? "");

  return (
    <section className="poster-card rounded-md overflow-hidden">
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
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-7">
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
        <div className="rounded-md border border-accent/40 bg-accent/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Quick scene change</p>
              {magicSceneIndex >= 0 && (
                <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent">
                  {MAGIC_SCENES[magicSceneIndex].name}
                </span>
              )}
            </div>
            <p className="text-xs text-grey mt-1">
              One click coordinates dialogue, SFX, theme, still, and video prompts. Nothing is charged until you generate.
            </p>
          </div>
          <button
            type="button"
            onClick={applyMagicScene}
            disabled={Boolean(busy)}
            data-action="magic-scene"
            className="shrink-0 rounded-full bg-accent text-paper px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
          >
            ✦ Magic Scene
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="border border-line rounded-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">1. Unique voice identity</h3>
              {character.voiceId && <span className="text-[10px] text-emerald-600 uppercase">Voice locked</span>}
            </div>
            <textarea value={voiceDescription} onChange={(event) => setVoiceDescription(event.target.value)} rows={4} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            <textarea value={previewText} onChange={(event) => setPreviewText(event.target.value)} rows={3} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
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

          <div className="border border-line rounded-md p-4 flex flex-col gap-3">
            <h3 className="font-semibold text-sm">2. Dialogue in her voice</h3>
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

        <div className="border border-line rounded-md p-4 flex flex-col gap-3">
          <h3 className="font-semibold text-sm">3. Signature SFX</h3>
          <input data-scene-field="sfx" value={sfxPrompt} onChange={(event) => setSfxPrompt(event.target.value)} className="bg-paper border border-line rounded-sm p-3 text-xs focus:outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={generateSfx} disabled={!elevenReady || Boolean(busy)} className="border border-accent text-accent rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "sfx" ? "Building sound..." : "Generate 5-second SFX"}
            </button>
            {sfxUrl && <div className="flex-1 min-w-64"><MediaPlayer src={sfxUrl} label={`${character.name} signature SFX`} compact /></div>}
          </div>
        </div>

        <div className="border border-line rounded-md p-4 flex flex-col gap-3">
          <h3 className="font-semibold text-sm">4. Theme score</h3>
          <input data-scene-field="theme" value={themePrompt} onChange={(event) => setThemePrompt(event.target.value)} className="bg-paper border border-line rounded-sm p-3 text-xs focus:outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={generateTheme} disabled={!elevenReady || Boolean(busy)} className="border border-accent text-accent rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "theme" ? "Composing theme..." : "Generate 12-second theme"}
            </button>
            {themeUrl && <div className="flex-1 min-w-64"><MediaPlayer src={themeUrl} label={`${character.name} theme`} compact /></div>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="border border-line rounded-md p-4 flex flex-col gap-3">
            <h3 className="font-semibold text-sm">5. Consistent scene still</h3>
            <textarea data-scene-field="image" value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={7} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            <button onClick={generateImage} disabled={!seedModelsReady || Boolean(busy)} className="bg-accent text-paper rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "image" ? "Seedream is creating..." : "Generate scene image"}
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

          <div className="border border-line rounded-md p-4 flex flex-col gap-3">
            <h3 className="font-semibold text-sm">6. Animate a five-second scene</h3>
            <textarea data-scene-field="video" value={scenePrompt} onChange={(event) => setScenePrompt(event.target.value)} rows={7} className="bg-paper border border-line rounded-sm p-3 text-xs resize-none focus:outline-none focus:border-accent" />
            <button onClick={generateVideo} disabled={!seedModelsReady || Boolean(busy)} className="bg-accent text-paper rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "video" ? "Seedance is rendering..." : "Generate 5-second video"}
            </button>
            <p className="text-[11px] text-grey">Seedance 1.5 Pro uses the newest generated still, or the current profile art, as its identity reference and creates synchronized audio.</p>
            {(generatedVideo || character.videoUrl) && <MediaPlayer src={generatedVideo || character.videoUrl || ""} label={`${character.name} scene`} kind="video" />}
          </div>
        </div>

        <section data-generation-history className="border border-line rounded-md overflow-hidden">
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
                return (
                  <article key={asset.id} className="rounded-md border border-line bg-black/10 p-3 min-w-0">
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
        </section>

        {message && <p className={`text-xs rounded-sm px-3 py-2 ${message.toLowerCase().includes("failed") || message.includes("not configured") ? "bg-red-500/10 text-red-600" : "bg-accent/10 text-ink"}`}>{message}</p>}
      </div>
    </section>
  );
}
