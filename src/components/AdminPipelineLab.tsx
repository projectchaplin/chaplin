"use client";

import { useMemo, useState } from "react";
import {
  PIPELINE_STAGE_IDS,
  PIPELINE_STAGE_META,
  type PipelineConfig,
  type PipelineStageConfig,
  type PipelineStageId,
} from "@/lib/pipeline-config";

type RecentRun = {
  id: string;
  kind: string;
  provider: string;
  model: string;
  status: string;
  prompt: string | null;
  costUsd: number | null;
  createdAt: string;
  outputUrl: string | null;
};

type FieldDefinition = {
  key: string;
  label: string;
  type: "number" | "text" | "boolean";
  min?: number;
  max?: number;
  step?: number;
  note: string;
};

const STAGE_FIELDS: Record<PipelineStageId, FieldDefinition[]> = {
  writing: [
    { key: "sceneVariations", label: "Suggested variations", type: "number", min: 1, max: 8, step: 1, note: "How many alternate creative directions the UI should offer." },
    { key: "requireVisibleHook", label: "Require visible hook", type: "boolean", note: "The hook must be readable in the frame or first second." },
    { key: "requireCliffhanger", label: "Require cliffhanger", type: "boolean", note: "The beat must reverse power or introduce fresh pressure." },
  ],
  voice: [
    { key: "guidanceScale", label: "Voice design guidance", type: "number", min: 0, max: 10, step: 0.1, note: "Higher values follow the voice description more tightly." },
    { key: "dialogueModel", label: "Locked dialogue model", type: "text", note: "Model used after a voice has been locked." },
    { key: "stability", label: "Dialogue stability", type: "number", min: 0, max: 1, step: 0.01, note: "Higher is steadier; lower allows more performance variation." },
    { key: "similarityBoost", label: "Voice similarity", type: "number", min: 0, max: 1, step: 0.01, note: "How tightly dialogue adheres to the locked voice identity." },
    { key: "style", label: "Style exaggeration", type: "number", min: 0, max: 1, step: 0.01, note: "Additional expressive styling. Keep low for repeatability." },
    { key: "speakerBoost", label: "Speaker boost", type: "boolean", note: "Improves resemblance to the locked voice at extra processing cost." },
  ],
  sfx: [
    { key: "durationSeconds", label: "Default seconds", type: "number", min: 0.5, max: 5, step: 0.1, note: "Target duration sent to ElevenLabs." },
    { key: "minimumDurationSeconds", label: "Minimum seconds", type: "number", min: 0.5, max: 5, step: 0.1, note: "Lower clamp for editor requests." },
    { key: "maximumDurationSeconds", label: "Maximum seconds", type: "number", min: 0.5, max: 8, step: 0.1, note: "Upper clamp for editor requests." },
    { key: "promptInfluence", label: "Prompt influence", type: "number", min: 0, max: 1, step: 0.01, note: "Higher values follow the written material and acoustic direction more tightly." },
    { key: "candidateCount", label: "Candidate takes", type: "number", min: 1, max: 6, step: 1, note: "Variations offered to the sound engineer." },
  ],
  theme: [
    { key: "durationSeconds", label: "Theme seconds", type: "number", min: 3, max: 30, step: 1, note: "Length of the generated identity theme." },
    { key: "forceInstrumental", label: "Force instrumental", type: "boolean", note: "Blocks generated vocals and lyrics." },
    { key: "signWithC2pa", label: "C2PA provenance", type: "boolean", note: "Requests provider provenance signing when available." },
  ],
  image: [
    { key: "size", label: "Output size", type: "text", note: "Seedream output dimensions, for example 2560x1440." },
    { key: "watermark", label: "Provider watermark", type: "boolean", note: "Adds the provider watermark to generated stills." },
    { key: "sequentialImageGeneration", label: "Sequential mode", type: "text", note: "Provider sequential-image setting." },
    { key: "negativePrompt", label: "Global negative prompt", type: "text", note: "Always appended to image exclusions." },
  ],
  video: [
    { key: "durationSeconds", label: "Video seconds", type: "number", min: 3, max: 12, step: 1, note: "Duration of each Seedance motion plate." },
    { key: "resolution", label: "Resolution", type: "text", note: "Provider resolution such as 720p or 1080p." },
    { key: "ratio", label: "Aspect ratio", type: "text", note: "Default production aspect ratio." },
    { key: "generateAudio", label: "Generate provider audio", type: "boolean", note: "Keep off when Chaplin mixes voice, SFX, and theme separately." },
    { key: "watermark", label: "Provider watermark", type: "boolean", note: "Adds the provider watermark to motion plates." },
    { key: "pollIntervalSeconds", label: "Poll interval", type: "number", min: 2, max: 20, step: 1, note: "Seconds between task status checks." },
    { key: "maximumPolls", label: "Maximum polls", type: "number", min: 5, max: 120, step: 1, note: "Timeout ceiling for one video job." },
  ],
};

const JOB_STAGE: Array<[PipelineStageId, RegExp]> = [
  ["voice", /voice|dialogue/],
  ["sfx", /sfx|sound/],
  ["theme", /theme|music/],
  ["image", /image|gallery|avatar|banner|still/],
  ["video", /video|motion/],
  ["writing", /prompt|script|scene|character|write/],
];

function stageForRun(kind: string) {
  return JOB_STAGE.find(([, pattern]) => pattern.test(kind))?.[0] ?? "writing";
}

function formatMoney(value: number | null) {
  return value == null ? "Cost pending" : `$${value.toFixed(4)}`;
}

export default function AdminPipelineLab({
  initialConfig,
  recentRuns,
}: {
  initialConfig: PipelineConfig;
  recentRuns: RecentRun[];
}) {
  const [config, setConfig] = useState(initialConfig);
  const [activeStage, setActiveStage] = useState<PipelineStageId>("writing");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testPrompt, setTestPrompt] = useState("");
  const [requestPreview, setRequestPreview] = useState("");
  const stage = config.stages[activeStage];
  const meta = PIPELINE_STAGE_META[activeStage];
  const stageRuns = useMemo(
    () => recentRuns.filter((run) => stageForRun(run.kind) === activeStage).slice(0, 6),
    [activeStage, recentRuns]
  );

  function replaceStage(next: PipelineStageConfig) {
    setConfig((current) => ({
      ...current,
      stages: { ...current.stages, [activeStage]: next },
    }));
    setMessage("");
  }

  function updateSetting(key: string, value: string | number | boolean) {
    replaceStage({ ...stage, settings: { ...stage.settings, [key]: value } });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pipeline", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await response.json() as { config?: PipelineConfig; error?: string };
      if (!response.ok || !data.config) throw new Error(data.error || "Settings could not be saved.");
      setConfig(data.config);
      setMessage(`Revision ${data.config.revision} is now active across the pipeline.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function compileRequestPreview() {
    const prelude = stage.promptPrelude.trim();
    const prompt = testPrompt.trim() || "No test idea entered.";
    setRequestPreview(JSON.stringify({
      stage: activeStage,
      enabled: stage.enabled,
      provider: stage.provider,
      model: stage.model,
      temperature: stage.temperature,
      maxTokens: stage.maxTokens,
      prompt: [prelude, prompt].filter(Boolean).join("\n\n"),
      providerSettings: stage.settings,
      note: "Safe request inspection only. No provider credits were used.",
    }, null, 2));
  }

  return (
    <div className="grid xl:grid-cols-[250px_minmax(0,1fr)] gap-5">
      <aside className="poster-card rounded-xl p-2 self-start xl:sticky xl:top-24">
        <p className="px-3 pt-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-grey">Pipeline stages</p>
        <div className="grid grid-cols-2 xl:grid-cols-1 gap-1">
          {PIPELINE_STAGE_IDS.map((id, index) => {
            const item = config.stages[id];
            const active = id === activeStage;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveStage(id);
                  setRequestPreview("");
                  setMessage("");
                }}
                className={`rounded-lg px-3 py-3 text-left border transition-colors ${
                  active ? "border-accent bg-accent/10 text-ink" : "border-transparent text-grey hover:border-line hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                  <span className={item.enabled ? "text-emerald-500" : "text-grey"}>{item.enabled ? "●" : "○"}</span>
                  0{index + 1}
                </span>
                <span className="block text-xs font-semibold mt-1">{PIPELINE_STAGE_META[id].label}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-line m-2 mt-3 p-3">
          <p className="text-[10px] uppercase tracking-wider text-grey">Active revision</p>
          <p className="text-2xl font-semibold mt-1">{config.revision}</p>
          <p className="text-[10px] text-grey mt-1">
            {config.updatedAt ? new Date(config.updatedAt).toLocaleString("en-IN") : "Code defaults"}
          </p>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        <section className="poster-card rounded-xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-line flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">{meta.owner}</p>
              <h2 className="reel-title text-2xl sm:text-3xl mt-1">{meta.label}</h2>
              <p className="text-sm text-grey mt-2 max-w-2xl">{meta.purpose}</p>
            </div>
            <label className="flex items-center gap-3 rounded-full border border-line px-4 py-2 text-xs font-semibold cursor-pointer self-start">
              <input
                type="checkbox"
                checked={stage.enabled}
                onChange={(event) => replaceStage({ ...stage, enabled: event.target.checked })}
                className="accent-accent"
              />
              {stage.enabled ? "Stage enabled" : "Stage paused"}
            </label>
          </div>

          <div className="p-5 sm:p-6 grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-grey">Provider</span>
              <input className="field mt-2 w-full" value={stage.provider} onChange={(event) => replaceStage({ ...stage, provider: event.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-grey">Model</span>
              <input className="field mt-2 w-full" value={stage.model} onChange={(event) => replaceStage({ ...stage, model: event.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[10px] uppercase tracking-wider text-grey">Global creative instruction</span>
              <textarea
                className="field mt-2 w-full min-h-28 resize-y"
                value={stage.promptPrelude}
                onChange={(event) => replaceStage({ ...stage, promptPrelude: event.target.value })}
                placeholder="Instruction applied before the creator's prompt"
              />
              <span className="text-[10px] text-grey mt-1 block">This is added to every {meta.label.toLowerCase()} request. Character-specific canon still takes priority.</span>
            </label>

            {meta.temperatureSupported ? (
              <>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-grey">Temperature · {stage.temperature?.toFixed(2)}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={stage.temperature ?? 0.65}
                    onChange={(event) => replaceStage({ ...stage, temperature: Number(event.target.value) })}
                    className="w-full mt-4 accent-accent"
                  />
                  <span className="text-[10px] text-grey mt-2 block">Lower is more repeatable; higher explores broader creative angles.</span>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-grey">Maximum output tokens</span>
                  <input
                    type="number"
                    min={256}
                    max={12000}
                    step={128}
                    className="field mt-2 w-full"
                    value={stage.maxTokens ?? 8000}
                    onChange={(event) => replaceStage({ ...stage, maxTokens: Number(event.target.value) })}
                  />
                </label>
              </>
            ) : (
              <div className="md:col-span-2 rounded-lg border border-line bg-black/10 p-4">
                <p className="text-xs font-semibold">Temperature is not a native control for this provider stage.</p>
                <p className="text-[11px] text-grey mt-1">Use the provider controls below; they map directly to the request payload.</p>
              </div>
            )}
          </div>

          <div className="border-t border-line p-5 sm:p-6">
            <h3 className="text-sm font-semibold">Provider controls</h3>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {STAGE_FIELDS[activeStage].map((definition) => {
                const value = stage.settings[definition.key];
                if (definition.type === "boolean") {
                  return (
                    <label key={definition.key} className="rounded-lg border border-line p-4 flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => updateSetting(definition.key, event.target.checked)}
                        className="mt-0.5 accent-accent"
                      />
                      <span>
                        <span className="block text-xs font-semibold">{definition.label}</span>
                        <span className="block text-[10px] text-grey mt-1">{definition.note}</span>
                      </span>
                    </label>
                  );
                }
                return (
                  <label key={definition.key} className={definition.key === "negativePrompt" ? "md:col-span-2" : ""}>
                    <span className="text-xs font-semibold">{definition.label}</span>
                    <input
                      type={definition.type}
                      min={definition.min}
                      max={definition.max}
                      step={definition.step}
                      className="field mt-2 w-full"
                      value={String(value ?? "")}
                      onChange={(event) => updateSetting(
                        definition.key,
                        definition.type === "number" ? Number(event.target.value) : event.target.value
                      )}
                    />
                    <span className="text-[10px] text-grey mt-1 block">{definition.note}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className={`text-xs ${/could not|required/i.test(message) ? "text-red-400" : "text-emerald-500"}`} aria-live="polite">{message}</p>
            <button type="button" onClick={save} disabled={saving} className="accent-btn rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
              {saving ? "Activating…" : "Save & activate revision"}
            </button>
          </div>
        </section>

        <section className="poster-card rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">Safe test bench</p>
              <h3 className="reel-title text-xl mt-1">Inspect the effective request</h3>
              <p className="text-xs text-grey mt-1">Compile the exact provider payload before spending credits.</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-500">No charge</span>
          </div>
          <textarea
            className="field mt-4 w-full min-h-24 resize-y"
            value={testPrompt}
            onChange={(event) => setTestPrompt(event.target.value)}
            placeholder={`Enter a test idea for ${meta.label.toLowerCase()}…`}
          />
          <button type="button" onClick={compileRequestPreview} className="mt-3 rounded-full border border-accent px-5 py-2 text-xs font-semibold text-accent hover:bg-accent/10">
            Compile test request
          </button>
          {requestPreview && (
            <pre className="branded-scroll mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-black/25 p-4 text-[11px] leading-relaxed text-grey">
              {requestPreview}
            </pre>
          )}
        </section>

        <section className="poster-card rounded-xl p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">Creation output</p>
              <h3 className="reel-title text-xl mt-1">Recent {meta.label.toLowerCase()} runs</h3>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-grey">{stageRuns.length} shown</span>
          </div>
          <div className="mt-4 divide-y divide-line">
            {stageRuns.length ? stageRuns.map((run) => (
              <div key={run.id} className="py-4 grid sm:grid-cols-[1fr_auto] gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${run.status === "succeeded" ? "bg-emerald-500" : run.status === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                    <span className="text-xs font-semibold">{run.kind}</span>
                    <span className="text-[10px] uppercase text-grey">{run.provider} · {run.model}</span>
                  </div>
                  <p className="text-[11px] text-grey mt-2 line-clamp-2">{run.prompt || "No prompt recorded"}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold">{formatMoney(run.costUsd)}</p>
                  <p className="text-[10px] text-grey mt-1">{new Date(run.createdAt).toLocaleString("en-IN")}</p>
                  {run.outputUrl && <a href={run.outputUrl} target="_blank" rel="noreferrer" className="text-[10px] text-accent hover:underline">Open output ↗</a>}
                </div>
              </div>
            )) : (
              <p className="py-8 text-center text-xs text-grey">No recorded runs for this stage yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
