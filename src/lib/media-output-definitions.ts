import type { MediaOutputDefinition, MediaOutputType, PipelineStepDefinition } from "@/lib/media-pipeline-types";

const step = (
  key: string,
  label: string,
  executor: PipelineStepDefinition["executor"],
  requiresReview = false,
  maxAttempts = 3
): PipelineStepDefinition => ({ key, label, executor, requiresReview, maxAttempts });

const imageFinish = [
  step("visual-qc", "Visual QC", "chaplin"),
  step("creative-review", "Creative approval", "human", true),
];

const shotSteps: PipelineStepDefinition[] = [
  step("plan-lock", "Lock shot plan", "chaplin"),
  step("reference-frame", "Generate reference frame", "seedream"),
  step("reference-review", "Approve identity and composition", "human", true),
  step("motion-plate", "Generate silent motion plate", "seedance"),
  step("dialogue", "Generate locked-voice dialogue", "elevenlabs"),
  step("sfx", "Generate sound effects", "elevenlabs"),
  step("room-tone", "Generate room tone", "elevenlabs"),
  step("shot-mix", "Mix and mux shot", "ffmpeg"),
  step("technical-qc", "Run technical QC", "chaplin"),
  step("creative-review", "Approve final shot", "human", true),
];

export const MEDIA_OUTPUT_DEFINITIONS: Record<MediaOutputType, MediaOutputDefinition> = {
  identity_still: {
    type: "identity_still",
    label: "Identity still",
    scope: "actor",
    description: "Canonical actor identity master and crop pack.",
    durationSeconds: null,
    publishable: false,
    steps: [
      step("identity-brief", "Lock identity brief", "chaplin"),
      step("identity-frame", "Generate identity master", "seedream"),
      step("identity-qc", "Run strict identity QC", "chaplin"),
      step("identity-review", "Approve canonical identity", "human", true),
      step("crop-pack", "Create delivery crops", "ffmpeg"),
    ],
  },
  gallery_still: {
    type: "gallery_still",
    label: "Gallery still",
    scope: "actor",
    description: "Casting or profile image derived from canonical identity.",
    durationSeconds: null,
    publishable: true,
    steps: [
      step("purpose-lock", "Lock image purpose", "chaplin"),
      step("gallery-frame", "Generate scene still", "seedream"),
      ...imageFinish,
    ],
  },
  poster: {
    type: "poster",
    label: "Poster and thumbnail",
    scope: "episode",
    description: "Discovery artwork and platform crop set.",
    durationSeconds: null,
    publishable: true,
    steps: [
      step("poster-brief", "Lock poster brief", "chaplin"),
      step("poster-frame", "Generate key art", "seedream"),
      ...imageFinish,
      step("crop-pack", "Create platform crops", "ffmpeg"),
    ],
  },
  spark: {
    type: "spark",
    label: "Spark",
    scope: "actor",
    description: "Private five-second casting audition.",
    durationSeconds: 5,
    publishable: false,
    steps: shotSteps,
  },
  punch: {
    type: "punch",
    label: "Punch",
    scope: "actor",
    description: "Public 15-second personality proof built from four authored four-second scenes.",
    durationSeconds: 15,
    publishable: true,
    steps: [
      step("promise-lock", "Lock personality promise", "chaplin"),
      step("shot-packages", "Produce four approved scene clips", "chaplin"),
      step("assembly", "Assemble 15-second master", "ffmpeg"),
      step("captions", "Create captions", "chaplin"),
      step("mastering", "Master delivery audio and video", "ffmpeg"),
      step("creative-review", "Approve Punch", "human", true),
    ],
  },
  shot: {
    type: "shot",
    label: "Shot package",
    scope: "shot",
    description: "One approved five-second audiovisual production unit.",
    durationSeconds: 5,
    publishable: false,
    steps: shotSteps,
  },
  episode: {
    type: "episode",
    label: "Episode",
    scope: "episode",
    description: "60-second microdrama built from twelve approved shots.",
    durationSeconds: 60,
    publishable: true,
    steps: [
      step("continuity-lock", "Lock episode continuity", "chaplin"),
      step("shot-packages", "Produce twelve approved shots", "chaplin"),
      step("assembly", "Assemble ordered episode", "ffmpeg"),
      step("mastering", "Master dialogue, theme and loudness", "ffmpeg"),
      step("captions", "Create captions and transcript", "chaplin"),
      step("technical-qc", "Run delivery QC", "chaplin"),
      step("story-qc", "Approve story and cliffhanger", "human", true),
      step("publish", "Publish approved episode", "chaplin"),
    ],
  },
  spot: {
    type: "spot",
    label: "Brand spot",
    scope: "spot",
    description: "Managed 30- or 60-second commercial delivery.",
    durationSeconds: 30,
    publishable: true,
    steps: [
      step("rights-lock", "Lock usage rights", "chaplin"),
      step("creative-lock", "Approve creative and claims", "human", true),
      step("shot-packages", "Produce approved spot shots", "chaplin"),
      step("brand-review", "Review picture lock", "human", true),
      step("assembly", "Assemble spot master", "ffmpeg"),
      step("mastering", "Master platform deliveries", "ffmpeg"),
      step("captions", "Create captions and localizations", "chaplin"),
      step("delivery-review", "Approve client delivery", "human", true),
      step("delivery-package", "Package masters and manifest", "chaplin"),
    ],
  },
  trailer: {
    type: "trailer",
    label: "Trailer or cutdown",
    scope: "episode",
    description: "Promotional edit derived from an approved master.",
    durationSeconds: 15,
    publishable: true,
    steps: [
      step("source-lock", "Lock approved source master", "chaplin"),
      step("edit", "Create promotional edit", "ffmpeg"),
      step("captions", "Rewrite and time captions", "chaplin"),
      step("platform-crops", "Create platform crops", "ffmpeg"),
      step("technical-qc", "Run delivery QC", "chaplin"),
      step("creative-review", "Approve cutdown", "human", true),
    ],
  },
  delivery_package: {
    type: "delivery_package",
    label: "Delivery package",
    scope: "episode",
    description: "Approved master, captions, artwork, and provenance manifest.",
    durationSeconds: null,
    publishable: true,
    steps: [
      step("source-lock", "Lock approved masters", "chaplin"),
      step("platform-encodes", "Create platform encodes", "ffmpeg"),
      step("manifest", "Archive production manifest", "chaplin"),
      step("package-qc", "Verify delivery package", "chaplin"),
      step("delivery-review", "Approve handoff", "human", true),
    ],
  },
};

export function getMediaOutputDefinition(type: MediaOutputType) {
  return MEDIA_OUTPUT_DEFINITIONS[type];
}

export const MEDIA_OUTPUT_CATALOG = Object.values(MEDIA_OUTPUT_DEFINITIONS);
