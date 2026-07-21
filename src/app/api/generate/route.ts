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
} from "@/lib/server/supabase-admin";
import { calculateGenerationBilling } from "@/lib/server/billing";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const ELEVEN_API = "https://api.elevenlabs.io/v1";
const MODEL_ARK_API = "https://ark.ap-southeast.bytepluses.com/api/v3";
const SEEDREAM_MODEL = "seedream-4-5-251128";
const SEEDANCE_MODEL = "seedance-1-5-pro-251215";
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

async function eleven(pathname: string, body: object) {
  const key = elevenKey();
  if (!key) throw new Error("ELEVEN_LABS_API_KEY is not configured.");
  const response = await fetch(`${ELEVEN_API}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs returned ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response;
}

async function imageInput(reference: string) {
  if (/^(https?:|data:)/.test(reference)) return reference;
  if (!reference.startsWith("/characters/")) {
    throw new Error("Reference image must be a generated URL or a character asset.");
  }
  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, `.${reference}`);
  if (!filePath.startsWith(publicRoot)) throw new Error("Invalid reference image path.");
  const bytes = await readFile(filePath);
  const contentType = reference.endsWith(".png") ? "image/png" : reference.endsWith(".jpg") || reference.endsWith(".jpeg") ? "image/jpeg" : "image/webp";
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export async function GET(request: Request) {
  const characterId = new URL(request.url).searchParams.get("characterId");
  const [production, providers] = characterId
    ? await Promise.all([
        getCharacterProductionState(characterId),
        getCharacterProviderHealth(characterId),
      ])
    : [null, null];
  return Response.json({
    elevenLabs: Boolean(elevenKey()),
    seedModels: Boolean(process.env.SEEDANCE_API_KEY ?? process.env.SEEDREAM_API_KEY),
    database: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    production,
    providers,
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

    if (action === "voice-design") {
      const description = text(input, "description", 20, 1000);
      const previewText = text(input, "previewText", 100, 1000);
      jobId = await beginGeneration({ characterId, kind: "voice-design", provider: "elevenlabs", model: "eleven_ttv_v3", prompt: description });
      const response = await eleven("/text-to-voice/design?output_format=mp3_44100_128", {
        voice_description: description,
        text: previewText,
        model_id: "eleven_ttv_v3",
        guidance_scale: 4,
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
      const description = text(input, "description", 20, 1000);
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
      const speechText = text(input, "speechText", 1, 5000);
      const production = await getCharacterProductionState(characterId);
      const voiceId = production.voiceId;
      if (!voiceId) throw new Error("This character has no active locked voice. Lock a voice before generating dialogue.");
      const seed = stableVoiceSeed(characterId);
      jobId = await beginGeneration({ characterId, kind: "dialogue", provider: "elevenlabs", model: DIALOGUE_MODEL, prompt: speechText });
      const response = await eleven(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        text: speechText,
        model_id: DIALOGUE_MODEL,
        voice_settings: DIALOGUE_VOICE_SETTINGS,
        seed,
      });
      const bytes = await response.arrayBuffer();
      const voiceMetadata = {
        voiceId,
        model: DIALOGUE_MODEL,
        seed,
        voiceSettings: DIALOGUE_VOICE_SETTINGS,
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
            inputCharacters: speechText.length,
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
          "X-Voice-Id": voiceId,
          "X-Voice-Model": DIALOGUE_MODEL,
        },
      });
    }

    if (action === "sfx") {
      const prompt = text(input, "prompt", 1, 1000);
      jobId = await beginGeneration({ characterId, kind: "sfx", provider: "elevenlabs", model: "eleven_text_to_sound_v2", prompt });
      const response = await eleven("/sound-generation?output_format=mp3_44100_128", {
        text: prompt,
        duration_seconds: 5,
        prompt_influence: 0.45,
        model_id: "eleven_text_to_sound_v2",
      });
      const bytes = await response.arrayBuffer();
      const asset = await saveMediaAsset({ characterId, kind: "sfx", provider: "elevenlabs", bytes, contentType: "audio/mpeg", prompt, durationSeconds: 5 });
      await completeGeneration(
        jobId,
        asset.id,
        undefined,
        await calculateGenerationBilling({
          kind: "sfx",
          usage: {
            inputCharacters: prompt.length,
            durationSeconds: 5,
            providerCredits: headerNumber(response, "character-cost"),
          },
        }),
        response.headers.get("request-id")
      );
      return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Asset-Url": asset.url } });
    }

    if (action === "theme") {
      const prompt = text(input, "prompt", 10, 1000);
      const durationSeconds = 12;
      jobId = await beginGeneration({ characterId, kind: "theme", provider: "elevenlabs", model: "music_v1", prompt });
      const response = await eleven("/music?output_format=mp3_44100_128", {
        prompt,
        music_length_ms: durationSeconds * 1000,
        model_id: "music_v1",
        force_instrumental: true,
        sign_with_c2pa: false,
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
      const prompt = text(input, "prompt", 10, 3000);
      jobId = await beginGeneration({ characterId, kind: "gallery", provider: "byteplus", model: SEEDREAM_MODEL, prompt });
      const generated = await modelArk("/images/generations", {
        model: SEEDREAM_MODEL,
        prompt,
        size: "2560x1440",
        response_format: "url",
        watermark: false,
      });
      const result = generated.data;
      const images = result.data as Array<{ url?: string }> | undefined;
      const url = images?.[0]?.url;
      if (!url) throw new Error("Seedream completed without returning an image.");
      const asset = await saveRemoteMediaAsset({ characterId, kind: "gallery", provider: "byteplus", remoteUrl: url, prompt });
      const providerUsage = result.usage as Record<string, unknown> | undefined;
      await completeGeneration(
        jobId,
        asset.id,
        undefined,
        await calculateGenerationBilling({
          kind: "gallery",
          usage: { imageCount: images.length, providerUsage },
          providerCostUsd: recordNumber(providerUsage, "cost_usd", "cost"),
        }),
        generated.requestId
      );
      return Response.json({ url: asset.url });
    }

    if (action === "video") {
      const requestedPrompt = text(input, "prompt", 10, 3000);
      const prompt = /silent visual plate|audio is produced separately/i.test(requestedPrompt)
        ? requestedPrompt
        : `${requestedPrompt}\nAUDIO: silent visual plate only; no generated speech, vocals, SFX, or music.`;
      jobId = await beginGeneration({ characterId, kind: "video", provider: "byteplus", model: SEEDANCE_MODEL, prompt });
      const reference = typeof input.referenceImage === "string" ? input.referenceImage : "";
      const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
      if (reference) {
        content.push({ type: "image_url", image_url: { url: await imageInput(reference) } });
      }
      const createdResponse = await modelArk("/contents/generations/tasks", {
        model: SEEDANCE_MODEL,
        content,
        resolution: "720p",
        duration: 5,
        ratio: "16:9",
        generate_audio: false,
        watermark: false,
      });
      const created = createdResponse.data;
      const taskId = created.id;
      if (typeof taskId !== "string") throw new Error("Seedance did not return a task ID.");

      let task: Record<string, unknown> = {};
      for (let attempt = 0; attempt < 55; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
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
      const asset = await saveRemoteMediaAsset({ characterId, kind: "video", provider: "byteplus", remoteUrl: videoUrl, prompt, durationSeconds: 5, metadata: { taskId } });
      const providerUsage = task.usage as Record<string, unknown> | undefined;
      await completeGeneration(
        jobId,
        asset.id,
        { taskId },
        await calculateGenerationBilling({
          kind: "video",
          usage: { durationSeconds: 5, providerUsage, providerTokens: recordNumber(providerUsage, "total_tokens", "output_tokens") },
          providerCostUsd: recordNumber(providerUsage, "cost_usd", "cost"),
        }),
        createdResponse.requestId ?? taskId
      );
      return Response.json({ url: asset.url, taskId });
    }

    return Response.json({ error: "Unknown generation action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    if (jobId) await failGeneration(jobId, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
