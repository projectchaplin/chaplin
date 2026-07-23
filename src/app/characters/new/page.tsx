"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import { ARCHETYPES } from "@/data/seed";
import type { Archetype, CharacterProductionBible, LicenseType, VoiceGender } from "@/lib/types";
import { ARCHETYPE_HUE, ARCHETYPE_LABEL, LICENSE_HUE, LICENSE_LABEL } from "@/lib/format";

const VOICE_PRESETS = [
  "Warm, steady, a little old-fashioned",
  "Cold, clipped, a faint smile in every sentence",
  "Bright, fast, cracks on the high notes",
  "Smoky, deliberate, theatrical lilt",
  "Gravelly, unhurried, pauses before punchlines",
  "Layered whisper, echoes its own last word",
  "Custom, describe it myself",
];

const SFX_PRESETS = [
  "A coin flip, mid-heist sting",
  "A lock tumbler clicking into place",
  "A firecracker fuse hissing, then a pop",
  "A door creaking, then a whisper",
  "Armor plates clinking as they turn to leave",
  "A hand bell, rung twice",
  "Custom, describe it myself",
];

const SCORE_PRESETS = [
  "Moody sitar riff over a slow tabla pulse",
  "Warm santoor over a slow harmonium drone",
  "Bouncy dhol-driven brass, festival energy",
  "Slow ghazal strings, a single sarangi line",
  "Detuned harmonium drone with a distant bell",
  "Driving nagada drums under a defiant string line",
  "Custom, describe it myself",
];

const HUE_SWATCHES = [340, 30, 205, 45, 150, 265, 18, 300, 220, 95];

type SuggestionTarget = "all" | "tagline" | "personality" | "voice" | "sfx" | "theme";
type CharacterSuggestion = {
  tagline: string;
  personality: string;
  voiceGender: VoiceGender;
  voiceDescription: string;
  signatureSfx: string;
  themeScore: string;
  productionBible: CharacterProductionBible;
};

type CharacterBuilderDraft = {
  version: 1;
  updatedAt: string;
  name: string;
  archetypes: Archetype[];
  characterBrief: string;
  tagline: string;
  personality: string;
  appearanceBrief: string;
  worldBrief: string;
  voiceGender: VoiceGender;
  voicePreset: string;
  customVoice: string;
  sfxPreset: string;
  customSfx: string;
  scorePreset: string;
  customScore: string;
  licenseType: LicenseType;
  royaltyRate: number;
  hue: number;
  productionBible?: CharacterProductionBible;
};

const IDENTITY_BUILD_STAGES = [
  { label: "Read canon", startsAt: 0 },
  { label: "Shape identity", startsAt: 8 },
  { label: "Direct voice", startsAt: 18 },
  { label: "Build bible", startsAt: 30 },
  { label: "Continuity pass", startsAt: 42 },
] as const;

function estimatedBuildProgress(target: SuggestionTarget, elapsedSeconds: number) {
  if (target !== "all") return Math.min(92, 12 + elapsedSeconds * 4);
  if (elapsedSeconds <= 8) return 4 + elapsedSeconds;
  if (elapsedSeconds <= 30) return Math.round(12 + (elapsedSeconds - 8) * 2.4);
  return Math.min(94, Math.round(65 + (elapsedSeconds - 30) * 1.2));
}

function activeBuildStage(elapsedSeconds: number) {
  return IDENTITY_BUILD_STAGES.reduce(
    (active, stage, index) => elapsedSeconds >= stage.startsAt ? index : active,
    0,
  );
}

function SuggestButton({
  target,
  activeTarget,
  onClick,
}: {
  target: SuggestionTarget;
  activeTarget: SuggestionTarget | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(activeTarget)}
      data-suggest-character={target}
      className="rounded-full border border-accent/50 px-2.5 py-1 text-[10px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
    >
      {activeTarget === target ? "Writing..." : target === "all" ? "✦ Build my character" : "✦ Suggest"}
    </button>
  );
}

export default function NewCharacterPage() {
  const router = useRouter();
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const addCharacter = useChaplinStore((s) => s.addCharacter);
  const removeCharacter = useChaplinStore((s) => s.removeCharacter);

  const [name, setName] = useState("");
  const [archetypes, setArchetypes] = useState<Archetype[]>(["hero"]);
  const [characterBrief, setCharacterBrief] = useState("");
  const [tagline, setTagline] = useState("");
  const [personality, setPersonality] = useState("");
  const [appearanceBrief, setAppearanceBrief] = useState("");
  const [worldBrief, setWorldBrief] = useState("");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("feminine");
  const [voicePreset, setVoicePreset] = useState(VOICE_PRESETS[0]);
  const [customVoice, setCustomVoice] = useState("");
  const [sfxPreset, setSfxPreset] = useState(SFX_PRESETS[0]);
  const [customSfx, setCustomSfx] = useState("");
  const [scorePreset, setScorePreset] = useState(SCORE_PRESETS[0]);
  const [customScore, setCustomScore] = useState("");
  const [licenseType, setLicenseType] = useState<LicenseType>("paid");
  const [royaltyRate, setRoyaltyRate] = useState(30);
  const [hue, setHue] = useState(205);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestingTarget, setSuggestingTarget] = useState<SuggestionTarget | null>(null);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [productionBible, setProductionBible] = useState<CharacterProductionBible | undefined>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [revealingField, setRevealingField] = useState("");
  const suggestStartedAt = useRef<number | null>(null);
  const restoredDraftKey = useRef<string | null>(null);
  const draftStorageKey = `chaplin-character-builder:${currentUserId}`;
  const progress = suggestingTarget ? estimatedBuildProgress(suggestingTarget, elapsedSeconds) : 0;
  const buildStage = activeBuildStage(elapsedSeconds);

  useEffect(() => {
    if (!suggestingTarget) {
      suggestStartedAt.current = null;
      return;
    }
    suggestStartedAt.current = Date.now();
    const interval = setInterval(() => {
      if (suggestStartedAt.current) {
        setElapsedSeconds(Math.floor((Date.now() - suggestStartedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [suggestingTarget]);

  useEffect(() => {
    if (restoredDraftKey.current === draftStorageKey) return;
    restoredDraftKey.current = draftStorageKey;
    const stored = window.localStorage.getItem(draftStorageKey);
    if (!stored) return;
    try {
      const draft = JSON.parse(stored) as Partial<CharacterBuilderDraft>;
      if (draft.version !== 1) return;
      const timer = window.setTimeout(() => {
        setName(draft.name ?? "");
        setArchetypes(
          Array.isArray(draft.archetypes) && draft.archetypes.length
            ? draft.archetypes.filter((value): value is Archetype => (ARCHETYPES as readonly string[]).includes(value))
            : ["hero"],
        );
        setCharacterBrief(draft.characterBrief ?? "");
        setTagline(draft.tagline ?? "");
        setPersonality(draft.personality ?? "");
        setAppearanceBrief(draft.appearanceBrief ?? "");
        setWorldBrief(draft.worldBrief ?? "");
        setVoiceGender(draft.voiceGender ?? "feminine");
        setVoicePreset(draft.voicePreset ?? VOICE_PRESETS[0]);
        setCustomVoice(draft.customVoice ?? "");
        setSfxPreset(draft.sfxPreset ?? SFX_PRESETS[0]);
        setCustomSfx(draft.customSfx ?? "");
        setScorePreset(draft.scorePreset ?? SCORE_PRESETS[0]);
        setCustomScore(draft.customScore ?? "");
        setLicenseType(draft.licenseType ?? "paid");
        setRoyaltyRate(typeof draft.royaltyRate === "number" ? draft.royaltyRate : 30);
        setHue(typeof draft.hue === "number" ? draft.hue : 205);
        setProductionBible(draft.productionBible);
        if (draft.name || draft.characterBrief || draft.tagline) {
          setSuggestionMessage("Draft recovered. Your character work is safe after refresh.");
        }
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (restoredDraftKey.current !== draftStorageKey) return;
    const timer = window.setTimeout(() => {
      const draft: CharacterBuilderDraft = {
        version: 1,
        updatedAt: new Date().toISOString(),
        name,
        archetypes,
        characterBrief,
        tagline,
        personality,
        appearanceBrief,
        worldBrief,
        voiceGender,
        voicePreset,
        customVoice,
        sfxPreset,
        customSfx,
        scorePreset,
        customScore,
        licenseType,
        royaltyRate,
        hue,
        productionBible,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    appearanceBrief,
    archetypes,
    characterBrief,
    customScore,
    customSfx,
    customVoice,
    draftStorageKey,
    hue,
    licenseType,
    name,
    personality,
    productionBible,
    royaltyRate,
    scorePreset,
    sfxPreset,
    tagline,
    voiceGender,
    voicePreset,
    worldBrief,
  ]);

  // Concierge hand-off prefills the editable builder but never starts a paid
  // generation automatically. The creator stays in control of every action.
  const conciergeRan = useRef(false);
  useEffect(() => {
    if (conciergeRan.current) return;
    const params = new URLSearchParams(window.location.search);
    const cname = params.get("cname")?.trim() ?? "";
    const cbrief = params.get("cbrief")?.trim() ?? "";
    const carchetypes = (params.get("carchetypes") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is Archetype => (ARCHETYPES as readonly string[]).includes(value));
    if (!cname && !cbrief && carchetypes.length === 0) return;
    conciergeRan.current = true;
    const timer = window.setTimeout(() => {
      if (cname) setName(cname);
      if (cbrief) setCharacterBrief(cbrief);
      if (carchetypes.length) setArchetypes(carchetypes);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const archetype = archetypes[0] ?? "hero";

  function toggleArchetype(a: Archetype) {
    setArchetypes((current) => {
      if (current.includes(a)) {
        // keep at least one selected
        return current.length > 1 ? current.filter((item) => item !== a) : current;
      }
      return [...current, a];
    });
  }

  const isCustomVoice = voicePreset === VOICE_PRESETS[VOICE_PRESETS.length - 1];
  const voiceDesc = isCustomVoice ? customVoice : voicePreset;
  const isCustomSfx = sfxPreset === SFX_PRESETS[SFX_PRESETS.length - 1];
  const sfxDesc = isCustomSfx ? customSfx : sfxPreset;
  const isCustomScore = scorePreset === SCORE_PRESETS[SCORE_PRESETS.length - 1];
  const themeDesc = isCustomScore ? customScore : scorePreset;

  async function suggestCharacter(
    target: SuggestionTarget,
    overrides?: { name?: string; characterBrief?: string; archetypes?: Archetype[] }
  ) {
    const effectiveName = overrides?.name ?? name;
    const effectiveBrief = overrides?.characterBrief ?? characterBrief;
    const effectiveArchetypes = overrides?.archetypes ?? archetypes;
    if (!effectiveName.trim()) {
      setError("Name the AI actor first, then Magic Character can build the identity.");
      return;
    }
    if (target === "all" && effectiveBrief.trim().length < 20) {
      setError("Give Magic Character at least a line or two about who this actor is — that brief drives the whole identity.");
      return;
    }
    setElapsedSeconds(0);
    setSuggestingTarget(target);
    setError("");
    setSuggestionMessage("");
    try {
      const response = await fetch("/api/write/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          name: effectiveName,
          archetype: effectiveArchetypes[0] ?? "hero",
          archetypes: effectiveArchetypes,
          characterBrief: effectiveBrief,
          tagline,
          personality,
          appearanceBrief,
          worldBrief,
          voiceGender,
          voiceDescription: voiceDesc,
          signatureSfx: sfxDesc,
          themeScore: themeDesc,
        }),
      });
      const data = await response.json() as {
        suggestion?: CharacterSuggestion;
        provider?: string;
        warning?: string;
        error?: string;
      };
      if (!response.ok || !data.suggestion) throw new Error(data.error || "Character suggestions failed.");
      const suggestion = data.suggestion;
      if (target === "all") {
        // Save the complete response before the staged reveal begins. A dev
        // refresh during the animation can therefore restore every generated
        // field, not only the brief that was present when the request started.
        const recoveredDraft: CharacterBuilderDraft = {
          version: 1,
          updatedAt: new Date().toISOString(),
          name: effectiveName,
          archetypes: effectiveArchetypes,
          characterBrief: effectiveBrief,
          tagline: suggestion.tagline,
          personality: suggestion.personality,
          appearanceBrief,
          worldBrief,
          voiceGender: suggestion.voiceGender,
          voicePreset: VOICE_PRESETS[VOICE_PRESETS.length - 1],
          customVoice: suggestion.voiceDescription,
          sfxPreset: SFX_PRESETS[SFX_PRESETS.length - 1],
          customSfx: suggestion.signatureSfx,
          scorePreset: SCORE_PRESETS[SCORE_PRESETS.length - 1],
          customScore: suggestion.themeScore,
          licenseType,
          royaltyRate,
          hue,
          productionBible: suggestion.productionBible,
        };
        window.localStorage.setItem(draftStorageKey, JSON.stringify(recoveredDraft));

        // Magic Create fills the form field by field, so you watch the actor
        // assemble instead of everything appearing in one blink.
        const reveal: Array<[string, () => void]> = [
          ["tagline", () => setTagline(suggestion.tagline)],
          ["personality", () => setPersonality(suggestion.personality)],
          ["voice", () => {
            setVoiceGender(suggestion.voiceGender);
            setVoicePreset(VOICE_PRESETS[VOICE_PRESETS.length - 1]);
            setCustomVoice(suggestion.voiceDescription);
          }],
          ["sfx", () => {
            setSfxPreset(SFX_PRESETS[SFX_PRESETS.length - 1]);
            setCustomSfx(suggestion.signatureSfx);
          }],
          ["theme", () => {
            setScorePreset(SCORE_PRESETS[SCORE_PRESETS.length - 1]);
            setCustomScore(suggestion.themeScore);
          }],
          ["bible", () => setProductionBible(suggestion.productionBible)],
        ];
        reveal.forEach(([label, apply], index) => {
          window.setTimeout(() => {
            apply();
            setRevealingField(label);
            setSuggestionMessage(`✦ ${label === "bible" ? "Actor Direction Bible" : label.charAt(0).toUpperCase() + label.slice(1)} written…`);
            if (index === reveal.length - 1) {
              window.setTimeout(() => {
                setRevealingField("");
                setSuggestionMessage(
                  data.warning || (data.provider === "anthropic"
                    ? "Claude expanded the character. Every suggestion is editable."
                    : "Character suggestions are ready. Every field remains editable.")
                );
              }, 700);
            }
          }, 450 * index);
        });
      } else {
        setProductionBible(suggestion.productionBible);
        if (target === "tagline") setTagline(suggestion.tagline);
        if (target === "personality") setPersonality(suggestion.personality);
        if (target === "voice") {
          setVoiceGender(suggestion.voiceGender);
          setVoicePreset(VOICE_PRESETS[VOICE_PRESETS.length - 1]);
          setCustomVoice(suggestion.voiceDescription);
        }
        if (target === "sfx") {
          setSfxPreset(SFX_PRESETS[SFX_PRESETS.length - 1]);
          setCustomSfx(suggestion.signatureSfx);
        }
        if (target === "theme") {
          setScorePreset(SCORE_PRESETS[SCORE_PRESETS.length - 1]);
          setCustomScore(suggestion.themeScore);
        }
        setSuggestionMessage(
          data.warning || (data.provider === "anthropic"
            ? "Claude expanded the character. Every suggestion is editable."
            : "Character suggestions are ready. Every field remains editable.")
        );
      }
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : "Character suggestions failed.");
    } finally {
      setSuggestingTarget(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !name.trim() ||
      !tagline.trim() ||
      !personality.trim() ||
      !voiceDesc.trim() ||
      !sfxDesc.trim() ||
      !themeDesc.trim()
    ) {
      setError("Every field earns this AI actor a place on the shelf, fill them all in.");
      return;
    }
    setSaving(true);
    setError("");
    const character = addCharacter({
      makerId: currentUserId,
      name: name.trim(),
      archetype,
      archetypeMix: archetypes,
      tagline: tagline.trim(),
      personality: personality.trim(),
      voiceGender,
      voiceDesc: voiceDesc.trim(),
      sfxDesc: sfxDesc.trim(),
      themeDesc: themeDesc.trim(),
      productionBible,
      avatarHue: hue,
      licenseType,
      royaltyRate,
    });
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(character),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Saving the AI actor returned ${response.status}.`);
      }
      window.localStorage.removeItem(draftStorageKey);
      window.dispatchEvent(new CustomEvent("chaplin:catalogue-updated", { detail: { characterId: character.id } }));
      router.push(`/characters/${character.id}`);
    } catch (submitError) {
      removeCharacter(character.id);
      setError(submitError instanceof Error ? submitError.message : "The AI actor could not be saved.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 pt-5 sm:px-6 sm:py-10">
      <Link href="/characters" className="inline-flex items-center gap-1.5 text-xs text-grey hover:text-accent">
        <span aria-hidden="true">←</span> Actors
      </Link>

      <div className="mb-5 mt-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">New actor</p>
        <h1 className="reel-title text-3xl sm:text-4xl">Create an AI actor</h1>
        <p className="mt-1 text-sm text-grey">Name them. Describe the vibe. Chaplin builds the rest.</p>
      </div>

      <section className="mb-6" aria-label="Actor production pipeline">
        <div className="grid grid-cols-5 gap-1.5">
          {[
            ["01", "Identity"],
            ["02", "Look"],
            ["03", "Voice"],
            ["04", "Spark"],
            ["05", "Publish"],
          ].map(([number, label], index) => (
            <div key={number} className="min-w-0">
              <span className={`block h-1 rounded-full ${index === 0 ? "bg-accent" : "bg-line"}`} />
              <p className={`mt-2 truncate text-[9px] font-semibold uppercase tracking-[0.08em] ${index === 0 ? "text-ink" : "text-grey"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="poster-card flex flex-col gap-5 rounded-2xl p-4 sm:rounded-md sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar hue={hue} label={name || "?"} size={56} />
          <div className="flex flex-wrap gap-1.5">
            {HUE_SWATCHES.map((h) => (
              <button
                type="button"
                key={h}
                onClick={() => setHue(h)}
                className="w-6 h-6 rounded-full border-2"
                style={{
                  background: `hsl(${h} 55% 55%)`,
                  borderColor: h === hue ? "var(--ink)" : "transparent",
                }}
                aria-label={`Pick color ${h}`}
              />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            data-character-field="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ferra Voss"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Pick the vibe</span>
          <div className="flex flex-wrap gap-1.5">
            {ARCHETYPES.map((a) => (
              <button type="button" key={a} onClick={() => toggleArchetype(a)}>
                <Chip
                  label={a === archetype ? `★ ${ARCHETYPE_LABEL[a]}` : ARCHETYPE_LABEL[a]}
                  hue={ARCHETYPE_HUE[a]}
                  filled={archetypes.includes(a)}
                />
              </button>
            ))}
          </div>
        </label>

        <details className="overflow-hidden rounded-md border border-accent/50 bg-accent/5" data-magic-character-assist>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-accent/[0.05]">
            <span>
              <span className="block text-sm font-semibold">✦ Magic character assist</span>
              <span className="mt-0.5 block text-[11px] text-grey">Optional: use one brief to prefill the identity boxes below.</span>
            </span>
            <span className="shrink-0 rounded-full border border-accent/50 px-3 py-1 text-[10px] font-semibold text-accent">Open</span>
          </summary>
          <div className="border-t border-line p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-sm font-semibold">One brief, editable results</p>
              <p className="mt-1 text-xs text-grey">
                Name the actor, pick the archetype mix, then let AI prefill every field. Nothing is generated or charged until you choose it.
              </p>
            </div>
            <div className="shrink-0">
              <SuggestButton
                target="all"
                activeTarget={suggestingTarget}
                onClick={() => void suggestCharacter("all")}
              />
            </div>
          </div>
          <textarea
            data-character-field="brief"
            value={characterBrief}
            onChange={(event) => setCharacterBrief(event.target.value)}
            rows={2}
            placeholder="Required: e.g. A retired railway detective who solves crimes she caused in a past life. Kind in public, ruthless at chess."
            className="mt-3 w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none bg-paper"
          />
          <p className="mt-1 text-[11px] text-grey">
            Minimum a line or two. This brief is treated as canon for every generated field.
          </p>
          {suggestingTarget && (
            <div
              className="mt-3 overflow-hidden rounded-xl border border-accent/35 bg-[linear-gradient(135deg,rgba(244,67,108,0.10),rgba(26,52,38,0.28))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              data-suggest-progress
              role="progressbar"
              aria-label={suggestingTarget === "all" ? "Building the actor identity" : `Writing ${suggestingTarget}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
                    <span className="absolute inset-1 animate-ping rounded-full bg-accent/15" />
                    <span className="relative h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-grey">
                      Magic identity build
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-ink">
                      {suggestingTarget === "all"
                        ? IDENTITY_BUILD_STAGES[buildStage].label
                        : `Writing ${suggestingTarget}`}
                    </span>
                  </span>
                </div>
                <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-accent">
                  {progress}%
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
                <div
                  className="relative h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-light))] transition-[width] duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <span className="absolute inset-y-0 right-0 w-8 animate-pulse bg-white/40 blur-sm" />
                </div>
              </div>

              {suggestingTarget === "all" && (
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {IDENTITY_BUILD_STAGES.map((stage, index) => (
                    <div key={stage.label} className="min-w-0">
                      <span
                        className={`block h-0.5 rounded-full transition-colors ${
                          index <= buildStage ? "bg-accent" : "bg-white/10"
                        }`}
                      />
                      <span
                        className={`mt-1 block truncate text-[8px] ${
                          index === buildStage ? "font-semibold text-ink" : "text-grey/70"
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between gap-3 text-[9px] text-grey">
                <span>Usually ready in 30–55 seconds</span>
                <span className="shrink-0 tabular-nums">{elapsedSeconds}s elapsed</span>
              </div>
            </div>
          )}
          {suggestionMessage && (
            <p className="mt-3 text-[11px] text-grey" data-suggestion-message>
              {suggestionMessage}
            </p>
          )}
          </div>
        </details>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-grey">or craft it manually</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Face, age & wardrobe direction</span>
            <textarea
              value={appearanceBrief}
              onChange={(event) => setAppearanceBrief(event.target.value)}
              rows={3}
              placeholder="Optional: late 30s, angular face, cropped hair, weathered khaki jacket"
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">World, lighting & palette</span>
            <textarea
              value={worldBrief}
              onChange={(event) => setWorldBrief(event.target.value)}
              rows={3}
              placeholder="Optional: rain-dark railway world, tungsten practicals, deep green and brass"
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Tagline</span>
            <SuggestButton target="tagline" activeTarget={suggestingTarget} onClick={() => void suggestCharacter("tagline")} />
          </div>
          <input
            data-character-field="tagline"
            data-revealing={revealingField === "tagline" || undefined}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line that sells the pitch"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Personality</span>
            <SuggestButton target="personality" activeTarget={suggestingTarget} onClick={() => void suggestCharacter("personality")} />
          </div>
          <textarea
            data-character-field="personality"
            data-revealing={revealingField === "personality" || undefined}
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={3}
            placeholder="How they talk, what they want, what sets them off"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Voice</span>
            <SuggestButton target="voice" activeTarget={suggestingTarget} onClick={() => void suggestCharacter("voice")} />
          </div>
          <select
            value={voiceGender}
            onChange={(e) => setVoiceGender(e.target.value as VoiceGender)}
            className="border border-line rounded-sm px-3 py-2 bg-paper focus:outline-none focus:border-accent"
          >
            <option value="feminine">Feminine voice</option>
            <option value="masculine">Masculine voice</option>
            <option value="androgynous">Androgynous voice</option>
          </select>
          <select
            value={voicePreset}
            onChange={(e) => setVoicePreset(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 bg-paper focus:outline-none focus:border-accent"
          >
            {VOICE_PRESETS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {isCustomVoice && (
            <input
              data-character-field="voice"
              value={customVoice}
              onChange={(e) => setCustomVoice(e.target.value)}
              placeholder="Describe the voice yourself"
              className="border border-line rounded-sm px-3 py-2 mt-1 focus:outline-none focus:border-accent"
            />
          )}
          <span className="text-[11px] text-grey">
            Voice presentation is sent explicitly to ElevenLabs with the performance description.
          </span>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Signature SFX</span>
            <SuggestButton target="sfx" activeTarget={suggestingTarget} onClick={() => void suggestCharacter("sfx")} />
          </div>
          <select
            value={sfxPreset}
            onChange={(e) => setSfxPreset(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 bg-paper focus:outline-none focus:border-accent"
          >
            {SFX_PRESETS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {isCustomSfx && (
            <input
              data-character-field="sfx"
              value={customSfx}
              onChange={(e) => setCustomSfx(e.target.value)}
              placeholder="Describe the signature sound yourself"
              className="border border-line rounded-sm px-3 py-2 mt-1 focus:outline-none focus:border-accent"
            />
          )}
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Theme score</span>
            <SuggestButton target="theme" activeTarget={suggestingTarget} onClick={() => void suggestCharacter("theme")} />
          </div>
          <select
            value={scorePreset}
            onChange={(e) => setScorePreset(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 bg-paper focus:outline-none focus:border-accent"
          >
            {SCORE_PRESETS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {isCustomScore && (
            <input
              data-character-field="theme"
              value={customScore}
              onChange={(e) => setCustomScore(e.target.value)}
              placeholder="Describe the theme yourself"
              className="border border-line rounded-sm px-3 py-2 mt-1 focus:outline-none focus:border-accent"
            />
          )}
          <span className="text-[11px] text-grey">
            Real music generation wires in later, this describes it for now.
          </span>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">License</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(["open", "paid", "approval"] as LicenseType[]).map((l) => (
              <button
                type="button"
                key={l}
                onClick={() => setLicenseType(l)}
                className={`text-left border rounded-md p-3 transition-colors ${
                  licenseType === l ? "border-accent bg-accent/10" : "border-line hover:border-accent"
                }`}
              >
                <Chip label={LICENSE_LABEL[l]} hue={LICENSE_HUE[l]} filled={licenseType === l} />
                <p className="text-[11px] text-grey mt-2">
                  {l === "open" && "Free to cast. Fans can still tip."}
                  {l === "paid" && "Charges a fee every casting."}
                  {l === "approval" && "You sign off on each story first."}
                </p>
              </button>
            ))}
          </div>
          {licenseType !== "open" && (
            <label className="flex items-center gap-2 mt-1">
              <span className="text-xs text-grey">Fee per casting (reels)</span>
              <input
                type="number"
                min={5}
                max={200}
                value={royaltyRate}
                onChange={(e) => setRoyaltyRate(Number(e.target.value))}
                className="w-24 border border-line rounded-sm px-2 py-1 focus:outline-none focus:border-accent"
              />
            </label>
          )}
        </div>

        {productionBible && (
          <details className="rounded-md border border-line bg-paper/40 p-4" data-character-bible>
            <summary className="cursor-pointer text-sm font-semibold">Actor Direction Bible</summary>
            <p className="mt-1 text-[11px] text-grey">Saved with the actor and reused by stills, motion, voice, sound, music, and stories.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
              <div>
                <p className="font-semibold text-accent">Dramatic engine</p>
                <p className="mt-1"><span className="text-grey">Want:</span> {productionBible.dramatic.externalWant}</p>
                <p className="mt-1"><span className="text-grey">Contradiction:</span> {productionBible.dramatic.contradiction}</p>
                <p className="mt-1"><span className="text-grey">Vulnerability:</span> {productionBible.dramatic.vulnerability}</p>
              </div>
              <div>
                <p className="font-semibold text-accent">Performance tells</p>
                <p className="mt-1"><span className="text-grey">Face:</span> {productionBible.performance.restingExpression}</p>
                <p className="mt-1"><span className="text-grey">Pressure:</span> {productionBible.performance.underPressure}</p>
                <p className="mt-1"><span className="text-grey">Movement:</span> {productionBible.performance.movementStyle}</p>
              </div>
              <div>
                <p className="font-semibold text-accent">Identity hero image</p>
                <p className="mt-1"><span className="text-grey">Face anchors:</span> {productionBible.visual.faceAnchors.join("; ")}</p>
                <p className="mt-1"><span className="text-grey">Wardrobe:</span> {productionBible.visual.wardrobe}</p>
                <p className="mt-1"><span className="text-grey">Frame:</span> {productionBible.cinematography.heroFraming}; {productionBible.cinematography.cameraHeight}; {productionBible.cinematography.lens}</p>
                <p className="mt-1"><span className="text-grey">Light:</span> {productionBible.cinematography.keyLight}</p>
                <p className="mt-1"><span className="text-grey">World:</span> {productionBible.cinematography.worldTexture}</p>
              </div>
              <div>
                <p className="font-semibold text-accent">Story engine</p>
                <p className="mt-1"><span className="text-grey">Hook:</span> {productionBible.story.hookPattern}</p>
                <p className="mt-1"><span className="text-grey">Cliffhanger:</span> {productionBible.story.cliffhangerPattern}</p>
              </div>
            </div>
          </details>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-paper font-semibold px-4 py-3 rounded-sm hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          {saving ? "Saving AI actor…" : `Put ${name.trim() || "this AI actor"} on the shelf`}
        </button>
      </form>
    </div>
  );
}
