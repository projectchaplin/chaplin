export const PIPELINE_STAGE_IDS = ["writing", "voice", "sfx", "theme", "image", "video"] as const;

export type PipelineStageId = typeof PIPELINE_STAGE_IDS[number];

export type PipelineStageConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  promptPrelude: string;
  temperature: number | null;
  maxTokens: number | null;
  settings: Record<string, string | number | boolean>;
};

export type PipelineConfig = {
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  stages: Record<PipelineStageId, PipelineStageConfig>;
};

export const PIPELINE_STAGE_META: Record<PipelineStageId, {
  label: string;
  owner: string;
  purpose: string;
  temperatureSupported: boolean;
}> = {
  writing: {
    label: "Writing & direction",
    owner: "Story editor",
    purpose: "Character expansion, Quick Write, scene hooks, shot blueprints, and production prompts.",
    temperatureSupported: false,
  },
  voice: {
    label: "Voice",
    owner: "Voice director",
    purpose: "Voice candidate design and repeatable locked-voice dialogue performance.",
    temperatureSupported: false,
  },
  sfx: {
    label: "Signature SFX",
    owner: "Sound engineer",
    purpose: "Short, repeatable physical sonic logos and their candidate variations.",
    temperatureSupported: false,
  },
  theme: {
    label: "Theme score",
    owner: "Music supervisor",
    purpose: "Instrumental character idents with a controlled motif, arc, and ending.",
    temperatureSupported: false,
  },
  image: {
    label: "Image",
    owner: "Cinematographer",
    purpose: "Identity masters and scene stills grounded in the canonical character reference.",
    temperatureSupported: false,
  },
  video: {
    label: "Video",
    owner: "Motion director",
    purpose: "Five-second image-to-video motion plates that preserve identity and composition.",
    temperatureSupported: false,
  },
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  revision: 1,
  updatedAt: null,
  updatedBy: null,
  stages: {
    writing: {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-5",
      promptPrelude: "Preserve character canon, visible causality, production constraints, and useful user intent. Return only the requested production artifact.",
      temperature: null,
      maxTokens: 8000,
      settings: {
        sceneVariations: 3,
        requireVisibleHook: true,
        requireCliffhanger: true,
      },
    },
    voice: {
      enabled: true,
      provider: "elevenlabs",
      model: "eleven_ttv_v3",
      promptPrelude: "Create an original, repeatable performance identity. Never imitate a real person.",
      temperature: null,
      maxTokens: null,
      settings: {
        guidanceScale: 4,
        dialogueModel: "eleven_multilingual_v2",
        stability: 0.78,
        similarityBoost: 0.9,
        style: 0,
        speakerBoost: true,
      },
    },
    sfx: {
      enabled: true,
      provider: "elevenlabs",
      model: "eleven_text_to_sound_v2",
      promptPrelude: "One short non-musical physical sound with an immediate attack, distinctive material detail, and clean stop.",
      temperature: null,
      maxTokens: null,
      settings: {
        durationSeconds: 1.5,
        minimumDurationSeconds: 0.5,
        maximumDurationSeconds: 2,
        promptInfluence: 0.35,
        candidateCount: 4,
      },
    },
    theme: {
      enabled: true,
      provider: "elevenlabs",
      model: "music_v1",
      promptPrelude: "Instrumental character ident with a foreground motif, controlled low end, and edit-ready ending.",
      temperature: null,
      maxTokens: null,
      settings: {
        durationSeconds: 12,
        forceInstrumental: true,
        signWithC2pa: false,
      },
    },
    image: {
      enabled: true,
      provider: "byteplus",
      model: "seedream-4-5-251128",
      promptPrelude: "Use the canonical reference as identity truth. Default to a visually striking live-action cinematic photograph of a real human with natural skin, tactile fabric, optical depth, physically plausible light, and restrained film grain. Change medium only when the user explicitly requests cartoon, anime, illustration, painting, CGI, or another stylized form.",
      temperature: null,
      maxTokens: null,
      settings: {
        size: "2560x1440",
        resolution: "2K",
        aspectRatio: "16:9",
        quality: "medium",
        outputFormat: "png",
        watermark: false,
        sequentialImageGeneration: "disabled",
        negativePrompt: "multiple people, duplicate face, celebrity likeness, generic pose, plastic skin, distorted anatomy, extra fingers, text, logo, UI, border, watermark, cartoon, anime, illustration, digital painting, concept art, 3D render, CGI character, game art, doll-like face, wax figure, airbrushed skin, synthetic skin",
      },
    },
    video: {
      enabled: true,
      provider: "byteplus",
      model: "seedance-1-5-pro-251215",
      promptPrelude: "Treat the supplied image as the exact first frame. Animate performance and camera only; never redesign identity, wardrobe, set, or lighting.",
      temperature: null,
      maxTokens: null,
      settings: {
        durationSeconds: 5,
        resolution: "720p",
        ratio: "16:9",
        generateAudio: false,
        watermark: false,
        pollIntervalSeconds: 5,
        maximumPolls: 55,
      },
    },
  },
};

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function normalizePipelineConfig(input: unknown, metadata?: {
  revision?: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}): PipelineConfig {
  const candidate = input && typeof input === "object" ? input as Partial<PipelineConfig> : {};
  const candidateStages: Partial<Record<PipelineStageId, Partial<PipelineStageConfig>>> =
    candidate.stages && typeof candidate.stages === "object" ? candidate.stages : {};
  const stages = {} as PipelineConfig["stages"];

  for (const id of PIPELINE_STAGE_IDS) {
    const defaults = DEFAULT_PIPELINE_CONFIG.stages[id];
    const raw = candidateStages[id] && typeof candidateStages[id] === "object"
      ? candidateStages[id] as Partial<PipelineStageConfig>
      : {};
    const settings = raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings)
      ? { ...defaults.settings, ...raw.settings }
      : { ...defaults.settings };
    stages[id] = {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
      provider: typeof raw.provider === "string" && raw.provider.trim() ? raw.provider.trim().slice(0, 80) : defaults.provider,
      model: typeof raw.model === "string" && raw.model.trim() ? raw.model.trim().slice(0, 120) : defaults.model,
      promptPrelude: typeof raw.promptPrelude === "string" ? raw.promptPrelude.trim().slice(0, 4000) : defaults.promptPrelude,
      temperature: PIPELINE_STAGE_META[id].temperatureSupported
        ? finiteNumber(raw.temperature, defaults.temperature ?? 0.65, 0, 1)
        : null,
      maxTokens: id === "writing"
        ? Math.round(finiteNumber(raw.maxTokens, defaults.maxTokens ?? 8000, 256, 12000))
        : null,
      settings,
    };
  }

  return {
    revision: metadata?.revision ?? Math.max(1, Number(candidate.revision) || 1),
    updatedAt: metadata?.updatedAt ?? candidate.updatedAt ?? null,
    updatedBy: metadata?.updatedBy ?? candidate.updatedBy ?? null,
    stages,
  };
}

export function settingNumber(stage: PipelineStageConfig, key: string, fallback: number) {
  const value = Number(stage.settings[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function settingBoolean(stage: PipelineStageConfig, key: string, fallback: boolean) {
  return typeof stage.settings[key] === "boolean" ? stage.settings[key] as boolean : fallback;
}

export function settingString(stage: PipelineStageConfig, key: string, fallback: string) {
  return typeof stage.settings[key] === "string" && stage.settings[key] ? stage.settings[key] as string : fallback;
}
