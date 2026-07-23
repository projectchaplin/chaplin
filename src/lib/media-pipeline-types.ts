export type MediaOutputType =
  | "identity_still"
  | "gallery_still"
  | "poster"
  | "spark"
  | "punch"
  | "shot"
  | "episode"
  | "spot"
  | "trailer"
  | "delivery_package";

export type PipelineScope = "actor" | "shot" | "episode" | "spot";
export type PipelineRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "needs_review"
  | "approved"
  | "assembling"
  | "succeeded"
  | "failed"
  | "cancelled";
export type PipelineStepStatus =
  | "blocked"
  | "ready"
  | "queued"
  | "running"
  | "needs_review"
  | "approved"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export type PipelineStepAction = "queue" | "start" | "complete" | "approve" | "reject" | "retry" | "skip" | "cancel";

export interface PipelineStepDefinition {
  key: string;
  label: string;
  executor: "chaplin" | "seedream" | "seedance" | "elevenlabs" | "ffmpeg" | "human";
  requiresReview?: boolean;
  maxAttempts?: number;
}

export interface MediaOutputDefinition {
  type: MediaOutputType;
  label: string;
  scope: PipelineScope;
  description: string;
  durationSeconds: number | null;
  publishable: boolean;
  steps: PipelineStepDefinition[];
}

export interface MediaPipelineStep {
  id: string;
  key: string;
  label: string;
  position: number;
  executor: string;
  status: PipelineStepStatus;
  requiresReview: boolean;
  attempt: number;
  maxAttempts: number;
  outputAssetId: string | null;
  errorMessage: string | null;
}

export interface MediaPipelineRun {
  id: string;
  scopeType: PipelineScope;
  scopeId: string;
  outputType: MediaOutputType;
  outputLabel: string;
  status: PipelineRunStatus;
  currentStep: string | null;
  spec: Record<string, unknown>;
  manifest: Record<string, unknown>;
  steps: MediaPipelineStep[];
  createdAt: string;
  updatedAt: string;
}
