import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  beginGeneration,
  completeGeneration,
  failGeneration,
  getCharacterProviderHealth,
  getCharacterProductionState,
  saveCharacterVoice,
  saveMediaAsset,
  saveRemoteMediaAsset,
  ensureCharacter,
  selectCharacterSfxAsset,
} from "@/lib/server/supabase-admin";
import { calculateGenerationBilling } from "@/lib/server/billing";
import type { Character } from "@/lib/types";
import { compactVoicePreview } from "@/lib/voice-preview";
import { dialogueForSpeech } from "@/lib/dialogue-performance";
import {
  settingBoolean,
  settingNumber,
  settingString,
  type PipelineStageConfig,
} from "@/lib/pipeline-config";
import { getPipelineConfig } from "@/lib/server/pipeline-config";

export const runtime = "nodejs";
export const maxDuration = 300;

const ELEVEN_API = "https://api.elevenlabs.io/v1";
const MODEL_ARK_API = "https://ark.ap-southeast.bytepluses.com/api/v3";
const DIALOGUE_MODEL = "eleven_multilingual_v2";
const DIALOGUE_VOICE_SETTINGS = {
  stability: 0.78,
  similarity_boost: 0.9,
  style: 0,
  use_speaker_boost: true,
};

type Input = Record<string, unknown>;

function text(input: Input, key: string, min = 1, max = 4000) {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new Error(`${key} must be between ${min} and ${max} characters.`);
  }
  return value.trim();
}

function elevenKey() {
  return process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY;
}

function modelArkKey() {
  const key = process.env.SEEDANCE_API_KEY ?? process.env.SEEDREAM_API_KEY;
  if (!key) {
    throw new Error("SEEDANCE_API_KEY (or SEEDREAM_API_KEY) is not configured.");
  }
  return key;
}

function requireStage(stage: PipelineStageConfig, label: string) {
  if (!stage.enabled) throw new Error(`${label} generation is paused by Super Admin.`);
}

function directedPrompt(stage: PipelineStageConfig, prompt: string) {
  return [stage.promptPrelude.trim(), prompt.trim()].filter(Boolean).join("\n\n");
}

const REALISM_DIRECTION = "OUTPUT MEDIUM: A visually striking live-action cinematic photograph of a real human being, captured through a physical camera and lens. Preserve natural facial asymmetry, pores, fine hair, believable hands, tactile fabric, grounded body weight, physically plausible light, optical depth, and restrained film grain. Do not render an illustration, cartoon, anime frame, digital painting, 3D render, CGI character, doll, or wax figure.";
const REALISM_NEGATIVE = "cartoon, anime, illustration, digital painting, concept art, 3D render, CGI character, game art, doll-like face, wax figure, airbrushed skin, synthetic skin, over-smoothed face";

function requestsStylizedImage(prompt: string) {
  const style = /\b(?:cartoon|anime|manga|animation|animated|illustration|illustrated|digital painting|3d render|cgi|game art|comic(?:-book)?|claymation)\b/i;
  return prompt.split(/[\n.!?;]/).some((clause) => {
    const match = style.exec(clause);
    if (!match) return false;
    if (/\b(?:locks?|exclusions?|negative prompt)\b/i.test(clause)) return false;
    const beforeStyle = clause.slice(0, match.index);
    return !/\b(?:no|not|never|avoid|without|exclude|excluding)\b(?:\W+\w+){0,3}\W*$/i.test(beforeStyle);
  });
}

const VISUAL_LABEL_PRIORITY = [
  "STYLE",
  "ACTOR",
  "SUBJECT AND IDENTITY",
  "SUBJECT",
  "VISIBLE PERSONALITY",
  "VISIBLE PERFORMANCE",
  "PERFORMANCE LOGIC",
  "DRAMATIC MOMENT",
  "PLAYABLE MOMENT",
  "INTENT",
  "SIGNATURE LOOK",
  "WORLD",
  "SET",
  "CAMERA AND COMPOSITION",
  "CAMERA",
  "LIGHTING",
  "LIGHT",
  "MOVEMENT",
  "SECONDARY MOTION",
  "FINAL FRAME",
  "CONTINUITY",
  "LOCKS AND EXCLUSIONS",
  "LOCKS",
  "EXCLUSIONS",
  "AUDIO",
];

function compactVisualDirection(prompt: string, kind: "image" | "video") {
  const cleaned = prompt
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labeled = new Map<string, string>();
  const unlabeled: string[] = [];
  for (const line of cleaned) {
    const match = /^([A-Z][A-Z /&+_-]{2,32}):\s*(.+)$/.exec(line);
    if (!match) {
      unlabeled.push(line);
      continue;
    }
    const label = match[1].trim();
    if (!labeled.has(label)) labeled.set(label, match[2].trim());
  }

  const maximumLine = kind === "image" ? 190 : 170;
  const selected = VISUAL_LABEL_PRIORITY
    .flatMap((label) => {
      const value = labeled.get(label);
      return value ? [`${label}: ${value.slice(0, maximumLine).trim()}`] : [];
    });
  const essentials = selected.length >= 3
    ? selected
    : [...selected, ...unlabeled.slice(0, kind === "image" ? 5 : 7).map((line) => line.slice(0, maximumLine).trim())];
  const maximumCharacters = kind === "image" ? 1800 : 1450;
  return essentials.join("\n").slice(0, maximumCharacters).trim();
}

function visualGenerationPrompt(stage: PipelineStageConfig, prompt: string, kind: "image" | "video") {
  const stylized = requestsStylizedImage(prompt);
  const explicitStyle = stylized
    ? prompt.split(/[\n.!?;]/).map((clause) => clause.trim()).find((clause) => requestsStylizedImage(clause))
    : "";
  const medium = stylized
    ? `OUTPUT MEDIUM: Preserve this explicit style consistently: ${explicitStyle?.slice(0, 180) || "the requested stylized medium"}. Do not drift into photorealism or an unrelated visual language.`
    : REALISM_DIRECTION;
  const brief = compactVisualDirection(prompt, kind);
  const adminDirection = stage.promptPrelude.replace(/\s+/g, " ").trim().slice(0, 400);
  return [medium, brief, adminDirection].filter(Boolean).join("\n\n");
}

function imageGenerationPrompt(stage: PipelineStageConfig, prompt: string) {
  return visualGenerationPrompt(stage, prompt, "image");
}

function providerPrompt(stage: PipelineStageConfig, prompt: string, maximumCharacters: number) {
  const direction = prompt.replace(/\s+/g, " ").trim();
  const adminDirection = stage.promptPrelude.replace(/\s+/g, " ").trim();
  return [direction, adminDirection]
    .filter(Boolean)
    .join(" ")
    .slice(0, maximumCharacters)
    .trim();
}

function voiceDesignDescription(stage: PipelineStageConfig, description: string) {
  const direction = description.replace(/\s+/g, " ").trim();
  const adminDirection = stage.promptPrelude.replace(/\s+/g, " ").trim();
  return [direction, adminDirection].filter(Boolean).join(" ").slice(0, 1000).trim();
}

function voiceDesignAuditionText(previewText: string) {
  const clean = compactVoicePreview(previewText);
  if (clean.length >= 100) return clean;
  return [
    clean,
    "I know what this moment costs, and I am choosing it anyway.",
    "Listen carefully; we only get one clean chance to do this right.",
  ].join(" ");
}

async function modelArk(pathname: string, body?: object) {
  const response = await fetch(`${MODEL_ARK_API}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${modelArkKey()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = data?.error as { message?: string; code?: string } | undefined;
    throw new Error(
      `BytePlus ModelArk returned ${response.status}: ${error?.message ?? error?.code ?? "Unknown provider error"}`
    );
  }
  return {
    data: data ?? {},
    requestId: response.headers.get("x-request-id") ?? response.headers.get("request-id"),
  };
}

function headerNumber(response: Response, name: string) {
  const raw = response.headers.get(name);
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function stableVoiceSeed(characterId: string) {
  let hash = 2166136261;
  for (const character of characterId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function recordNumber(record: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(record?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

async function eleven(pathname: string, body: Record<string, unknown>) {
  const key = elevenKey();
  if (!key) throw new Error("ELEVEN_LABS_API_KEY is not configured.");
  const effectiveBody = { ...body };
  if (pathname.startsWith("/text-to-voice/design")) {
    const auditionText = typeof effectiveBody.text === "string" ? effectiveBody.text.trim() : "";
    effectiveBody.text = voiceDesignAuditionText(auditionText);
    if (String(effectiveBody.text).length < 100) {
      throw new Error("Voice audition preparation failed to meet ElevenLabs' 100-character minimum.");
    }
  }
  if (pathname.startsWith("/sound-generation")) {
    const soundDescription = typeof effectiveBody.text === "string"
      ? effectiveBody.text.replace(/\s+/g, " ").trim()
      : "";
    effectiveBody.text = soundDescription.slice(0, 450).trim();
    if (!effectiveBody.text) {
      throw new Error("SFX generation needs a sound description.");
    }
  }
  const response = await fetch(`${ELEVEN_API}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key },
    body: JSON.stringify(effectiveBody),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs returned ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response;
}

async function imageInput(reference: string) {
  if (/^(https?:|data:)/.test(reference)) return reference;
  if (!reference.startsWith("/")) throw new Error("Reference image must be a generated URL or a public character asset.");
  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, `.${reference}`);
  const relativePath = path.relative(publicRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) throw new Error("Invalid reference image path.");
  const bytes = await readFile(filePath);
  const contentType = reference.endsWith(".png") ? "image/png" : reference.endsWith(".jpg") || reference.endsWith(".jpeg") ? "image/jpeg" : "image/webp";
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function lockVisualIdentity(prompt: string, hasReference: boolean) {
  if (!hasReference) return prompt;
  return `${prompt}\n\nVISUAL IDENTITY LOCK: The attached image is the canonical seed for this actor. Preserve the exact same person: facial geometry, eye spacing and shape, nose, mouth, jaw, skin tone and texture, hairline, hair, apparent age, body proportions, and signature wardrobe materials. The requested prompt may change only performance, blocking, camera, lighting, environment, and story action. Do not reinterpret, beautify, average, recast, age-shift, gender-shift, or redesign the actor.`;
}

export async function GET(request: Request) {
  const characterId = new URL(request.url).searchParams.get("characterId");
  const [production, providers, pipeline] = characterId
    ? await Promise.all([
        getCharacterProductionState(characterId),
        getCharacterProviderHealth(characterId),
        getPipelineConfig(),
      ])
    : [null, null, await getPipelineConfig()];
  return Response.json({
    elevenLabs: Boolean(elevenKey()),
    seedModels: Boolean(process.env.SEEDANCE_API_KEY ?? process.env.SEEDREAM_API_KEY),
    database: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    production,
    providers,
    pipeline,
  });
}

export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    const input = (await request.json()) as Input;
    const action = text(input, "action", 1, 30);
    const characterId = text(input, "characterId", 1, 100);
    if (input.character && typeof input.character === "object") {
      const character = input.character as Character;
      if (character.id !== characterId) throw new Error("AI actor identity does not match this generation request.");
      await ensureCharacter(character);
    }

    if (action === "sfx-select") {
      const assetId = text(input, "assetId", 1, 100);
      return Response.json(await selectCharacterSfxAsset({ characterId, assetId }));
    }

    const pipeline = await getPipelineConfig();

    if (action === "voice-design") {
      const voiceConfig = pipeline.stages.voice;
      requireStage(voiceConfig, "Voice");
      const description = voiceDesignDescription(voiceConfig, text(input, "description", 20, 4000));
      const previewText = voiceDesignAuditionText(text(input, "previewText", 12, 1000));
      jobId = await beginGeneration({ characterId, kind: "voice-design", provider: voiceConfig.provider, model: voiceConfig.model, prompt: description });
      const response = await eleven("/text-to-voice/design?output_format=mp3_44100_128", {
        voice_description: description,
        text: previewText,
        model_id: voiceConfig.model,
        guidance_scale: settingNumber(voiceConfig, "guidanceScale", 4),
      });
      const data = await response.json();
      const previews = Array.isArray(data.previews) ? data.previews : [];
      const billing = await calculateGenerationBilling({
        kind: "voice-design",
        usage: {
          inputCharacters: previewText.length * previews.length,
          durationSeconds: previews.reduce((total: number, preview: { duration_secs?: number }) => total + Number(preview.duration_secs ?? 0), 0),
          previewCount: previews.length,
          providerCredits: headerNumber(response, "character-cost"),
        },
      });
      await completeGeneration(jobId, undefined, { previewCount: previews.length }, billing, response.headers.get("request-id"));
      return Response.json(data);
    }

    if (action === "voice-save") {
      const voiceConfig = pipeline.stages.voice;
      requireStage(voiceConfig, "Voice");
      const description = voiceDesignDescription(voiceConfig, text(input, "description", 20, 4000));
      const generatedVoiceId = text(input, "generatedVoiceId", 1, 200);
      const currentProduction = await getCharacterProductionState(characterId);
      if (currentProduction.voiceId === generatedVoiceId) {
        return Response.json({ voice_id: generatedVoiceId, already_locked: true });
      }
      jobId = await beginGeneration({ characterId, kind: "voice-lock", provider: "elevenlabs", model: "text-to-voice", prompt: description });
      const response = await eleven("/text-to-voice", {
        voice_name: text(input, "name", 1, 100),
        voice_description: description,
        generated_voice_id: generatedVoiceId,
        labels: { project: "chaplin", character_id: characterId },
      });
      const data = await response.json();
      await saveCharacterVoice({ characterId, voiceId: data.voice_id, description, previewUrl: data.preview_url });
      await completeGeneration(
        jobId,
        undefined,
        { voiceId: data.voice_id },
        await calculateGenerationBilling({ kind: "voice-lock" }),
        response.headers.get("request-id")
      );
      return Response.json(data);
    }

    if (action === "speech") {
      const voiceConfig = pipeline.stages.voice;
      requireStage(voiceConfig, "Voice");
      const speechText = text(input, "speechText", 1, 5000);
      const performanceText = dialogueForSpeech(speechText);
      if (!performanceText) throw new Error("Dialogue must include words for the actor to perform.");
      const production = await getCharacterProductionState(characterId);
      const voiceId = production.voiceId;
      if (!voiceId) throw new Error("This character has no active locked voice. Lock a voice before generating dialogue.");
      const seed = stableVoiceSeed(characterId);
      const dialogueModel = settingString(voiceConfig, "dialogueModel", DIALOGUE_MODEL);
      const voiceSettings = {
        stability: settingNumber(voiceConfig, "stability", DIALOGUE_VOICE_SETTINGS.stability),
        similarity_boost: settingNumber(voiceConfig, "similarityBoost", DIALOGUE_VOICE_SETTINGS.similarity_boost),
        style: settingNumber(voiceConfig, "style", DIALOGUE_VOICE_SETTINGS.style),
        use_speaker_boost: settingBoolean(voiceConfig, "speakerBoost", DIALOGUE_VOICE_SETTINGS.use_speaker_boost),
      };
      jobId = await beginGeneration({ characterId, kind: "dialogue", provider: voiceConfig.provider, model: dialogueModel, prompt: speechText });
      const response = await eleven(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        text: performanceText,
        model_id: dialogueModel,
        voice_settings: voiceSettings,
        seed,
      });
      const bytes = await response.arrayBuffer();
      const voiceMetadata = {
        voiceId,
        model: dialogueModel,
        seed,
        voiceSettings,
        performanceText,
      };
      const asset = await saveMediaAsset({
        characterId,
        kind: "dialogue",
        provider: "elevenlabs",
        bytes,
        contentType: "audio/mpeg",
        prompt: speechText,
        metadata: voiceMetadata,
      });
      await completeGeneration(
        jobId,
        asset.id,
        voiceMetadata,
        await calculateGenerationBilling({
          kind: "dialogue",
          usage: {
            inputCharacters: performanceText.length,
            providerCredits: headerNumber(response, "character-cost"),
          },
        }),
        response.headers.get("request-id")
      );
      return new Response(bytes, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-Asset-Url": asset.url,
          "X-Asset-Id": asset.id,
          "X-Voice-Id": voiceId,
          "X-Voice-Model": dialogueModel,
        },
      });
    }

    if (action === "sfx") {
      const sfxConfig = pipeline.stages.sfx;
      requireStage(sfxConfig, "SFX");
      const prompt = providerPrompt(sfxConfig, text(input, "prompt", 1, 1000), 450);
      const requestedDuration = Number(input.durationSeconds);
      const minimumDuration = settingNumber(sfxConfig, "minimumDurationSeconds", 0.5);
      const maximumDuration = Math.max(minimumDuration, settingNumber(sfxConfig, "maximumDurationSeconds", 2));
      const durationSeconds = Number.isFinite(requestedDuration)
        ? Math.min(maximumDuration, Math.max(minimumDuration, requestedDuration))
        : settingNumber(sfxConfig, "durationSeconds", 1.5);
      jobId = await beginGeneration({ characterId, kind: "sfx", provider: sfxConfig.provider, model: sfxConfig.model, prompt });
      const response = await eleven("/sound-generation?output_format=mp3_44100_128", {
        text: prompt,
        duration_seconds: durationSeconds,
        prompt_influence: settingNumber(sfxConfig, "promptInfluence", 0.35),
        model_id: sfxConfig.model,
      });
      const bytes = await response.arrayBuffer();
      const asset = await saveMediaAsset({ characterId, kind: "sfx", provider: "elevenlabs", bytes, contentType: "audio/mpeg", prompt, durationSeconds });
      await completeGeneration(
        jobId,
        asset.id,
        undefined,
        await calculateGenerationBilling({
          kind: "sfx",
          usage: {
            inputCharacters: prompt.length,
            durationSeconds,
            providerCredits: headerNumber(response, "character-cost"),
          },
        }),
        response.headers.get("request-id")
      );
      return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Asset-Url": asset.url, "X-Asset-Id": asset.id, "X-SFX-Duration": String(durationSeconds) } });
    }

    if (action === "theme") {
      const themeConfig = pipeline.stages.theme;
      requireStage(themeConfig, "Theme");
      const prompt = directedPrompt(themeConfig, text(input, "prompt", 10, 1000));
      const durationSeconds = settingNumber(themeConfig, "durationSeconds", 12);
      jobId = await beginGeneration({ characterId, kind: "theme", provider: themeConfig.provider, model: themeConfig.model, prompt });
      const response = await eleven("/music?output_format=mp3_44100_128", {
        prompt,
        music_length_ms: durationSeconds * 1000,
        model_id: themeConfig.model,
        force_instrumental: settingBoolean(themeConfig, "forceInstrumental", true),
        sign_with_c2pa: settingBoolean(themeConfig, "signWithC2pa", false),
      });
      const bytes = await response.arrayBuffer();
      const asset = await saveMediaAsset({
        characterId,
        kind: "theme",
        provider: "elevenlabs",
        bytes,
        contentType: response.headers.get("content-type") ?? "audio/mpeg",
        prompt,
        durationSeconds,
        metadata: { songId: response.headers.get("song-id") },
      });
      await completeGeneration(
        jobId,
        asset.id,
        { songId: response.headers.get("song-id") },
        await calculateGenerationBilling({
          kind: "theme",
          usage: {
            inputCharacters: prompt.length,
            durationSeconds,
            providerCredits: headerNumber(response, "character-cost"),
          },
        }),
        response.headers.get("request-id") ?? response.headers.get("song-id")
      );
      return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Asset-Url": asset.url } });
    }

    if (action === "image") {
      const imageConfig = pipeline.stages.image;
      requireStage(imageConfig, "Image");
      const requestedPrompt = text(input, "prompt", 10, 6000);
      const imagePurpose = input.imagePurpose === "scene" ? "scene" : "identity";
      const requestedReference = typeof input.referenceImage === "string" ? input.referenceImage : "";
      const production = await getCharacterProductionState(characterId);
      const canonicalReference = production.visualReference;
      const reference = canonicalReference?.url ?? requestedReference;
      const stylizedOutput = requestsStylizedImage(requestedPrompt);
      const prompt = lockVisualIdentity(imageGenerationPrompt(imageConfig, requestedPrompt), Boolean(reference));
      const configuredNegativePrompt = settingString(
        imageConfig,
        "negativePrompt",
        "multiple people, duplicate face, celebrity likeness, generic pose, plastic skin, distorted anatomy, extra fingers, text, logo, UI, border, watermark"
      );
      const referenceMetadata = {
        imagePurpose,
        referenceImage: reference || null,
        referenceAssetId: canonicalReference?.assetId ?? null,
        referenceSource: canonicalReference?.source ?? (requestedReference ? "request-fallback" : null),
      };
      jobId = await beginGeneration({ characterId, kind: "gallery", provider: imageConfig.provider, model: imageConfig.model, prompt });
      const generationRequest: Record<string, unknown> = {
        model: imageConfig.model,
        prompt,
        negative_prompt: stylizedOutput
          ? configuredNegativePrompt
          : `${configuredNegativePrompt}, ${REALISM_NEGATIVE}`,
        size: settingString(imageConfig, "size", "2560x1440"),
        response_format: "url",
        sequential_image_generation: settingString(imageConfig, "sequentialImageGeneration", "disabled"),
        watermark: settingBoolean(imageConfig, "watermark", false),
      };
      if (reference) {
        generationRequest.image = await imageInput(reference);
      }
      const generated = await modelArk("/images/generations", generationRequest);
      const result = generated.data;
      const images = result.data as Array<{ url?: string }> | undefined;
      const url = images?.[0]?.url;
      if (!url) throw new Error("Seedream completed without returning an image.");
      const asset = await saveRemoteMediaAsset({
        characterId,
        kind: "gallery",
        provider: "byteplus",
        remoteUrl: url,
        prompt,
        metadata: referenceMetadata,
      });
      const providerUsage = result.usage as Record<string, unknown> | undefined;
      await completeGeneration(
        jobId,
        asset.id,
        referenceMetadata,
        await calculateGenerationBilling({
          kind: "gallery",
          usage: { imageCount: images.length, providerUsage },
          providerCostUsd: recordNumber(providerUsage, "cost_usd", "cost"),
        }),
        generated.requestId
      );
      return Response.json({ url: asset.url, assetId: asset.id });
    }

    if (action === "video") {
      const videoConfig = pipeline.stages.video;
      requireStage(videoConfig, "Video");
      const requestedPrompt = text(input, "prompt", 10, 3000);
      const silentPrompt = /silent visual plate|audio is produced separately/i.test(requestedPrompt)
        ? requestedPrompt
        : `${requestedPrompt}\nAUDIO: silent visual plate only; no generated speech, vocals, SFX, or music.`;
      const requestedReference = typeof input.referenceImage === "string" ? input.referenceImage : "";
      const production = await getCharacterProductionState(characterId);
      const canonicalReference = production.visualReference;
      const reference = canonicalReference?.url ?? requestedReference;
      const prompt = lockVisualIdentity(visualGenerationPrompt(videoConfig, silentPrompt, "video"), Boolean(reference));
      const referenceMetadata = {
        referenceImage: reference || null,
        referenceAssetId: canonicalReference?.assetId ?? null,
        referenceSource: canonicalReference?.source ?? (requestedReference ? "request-fallback" : null),
      };
      const durationSeconds = settingNumber(videoConfig, "durationSeconds", 5);
      jobId = await beginGeneration({ characterId, kind: "video", provider: videoConfig.provider, model: videoConfig.model, prompt });
      const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
      if (reference) {
        content.push({ type: "image_url", image_url: { url: await imageInput(reference) } });
      }
      const createdResponse = await modelArk("/contents/generations/tasks", {
        model: videoConfig.model,
        content,
        resolution: settingString(videoConfig, "resolution", "720p"),
        duration: durationSeconds,
        ratio: settingString(videoConfig, "ratio", "16:9"),
        generate_audio: settingBoolean(videoConfig, "generateAudio", false),
        watermark: settingBoolean(videoConfig, "watermark", false),
      });
      const created = createdResponse.data;
      const taskId = created.id;
      if (typeof taskId !== "string") throw new Error("Seedance did not return a task ID.");

      let task: Record<string, unknown> = {};
      const pollIntervalMs = settingNumber(videoConfig, "pollIntervalSeconds", 5) * 1000;
      const maximumPolls = settingNumber(videoConfig, "maximumPolls", 55);
      for (let attempt = 0; attempt < maximumPolls; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        task = (await modelArk(`/contents/generations/tasks/${encodeURIComponent(taskId)}`)).data;
        if (task.status === "succeeded") break;
        if (["failed", "cancelled", "expired"].includes(String(task.status))) {
          const providerError = task.error as { message?: string } | undefined;
          throw new Error(providerError?.message ?? `Seedance task ${task.status}.`);
        }
      }
      if (task.status !== "succeeded") throw new Error("Seedance timed out before completion.");
      const generated = task.content as { video_url?: string } | undefined;
      const videoUrl = generated?.video_url;
      if (!videoUrl) throw new Error("Seedance completed without returning a video.");
      const asset = await saveRemoteMediaAsset({
        characterId,
        kind: "video",
        provider: "byteplus",
        remoteUrl: videoUrl,
        prompt,
        durationSeconds,
        metadata: { taskId, ...referenceMetadata },
      });
      const providerUsage = task.usage as Record<string, unknown> | undefined;
      await completeGeneration(
        jobId,
        asset.id,
        { taskId, ...referenceMetadata },
        await calculateGenerationBilling({
          kind: "video",
          usage: { durationSeconds, providerUsage, providerTokens: recordNumber(providerUsage, "total_tokens", "output_tokens") },
          providerCostUsd: recordNumber(providerUsage, "cost_usd", "cost"),
        }),
        createdResponse.requestId ?? taskId
      );
      return Response.json({ url: asset.url, assetId: asset.id, taskId });
    }

    return Response.json({ error: "Unknown generation action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    if (jobId) await failGeneration(jobId, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
