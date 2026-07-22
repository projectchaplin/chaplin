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
  const activeRole = useChaplinStore((s) => s.activeRole);
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
  const suggestStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!suggestingTarget) {
      suggestStartedAt.current = null;
      setElapsedSeconds(0);
      return;
    }
    suggestStartedAt.current = Date.now();
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      if (suggestStartedAt.current) {
        setElapsedSeconds(Math.floor((Date.now() - suggestStartedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [suggestingTarget]);

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

  async function suggestCharacter(target: SuggestionTarget) {
    if (!name.trim()) {
      setError("Name the AI actor first, then Magic Character can build the identity.");
      return;
    }
    if (target === "all" && characterBrief.trim().length < 20) {
      setError("Give Magic Character at least a line or two about who this actor is — that brief drives the whole identity.");
      return;
    }
    setSuggestingTarget(target);
    setError("");
    setSuggestionMessage("");
    try {
      const response = await fetch("/api/write/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          name,
          archetype,
          archetypes,
          characterBrief,
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
      setProductionBible(suggestion.productionBible);
      if (target === "all" || target === "tagline") setTagline(suggestion.tagline);
      if (target === "all" || target === "personality") setPersonality(suggestion.personality);
      if (target === "all" || target === "voice") {
        setVoiceGender(suggestion.voiceGender);
        setVoicePreset(VOICE_PRESETS[VOICE_PRESETS.length - 1]);
        setCustomVoice(suggestion.voiceDescription);
      }
      if (target === "all" || target === "sfx") {
        setSfxPreset(SFX_PRESETS[SFX_PRESETS.length - 1]);
        setCustomSfx(suggestion.signatureSfx);
      }
      if (target === "all" || target === "theme") {
        setScorePreset(SCORE_PRESETS[SCORE_PRESETS.length - 1]);
        setCustomScore(suggestion.themeScore);
      }
      setSuggestionMessage(
        data.warning || (data.provider === "anthropic"
          ? "Claude expanded the character. Every suggestion is editable."
          : "Character suggestions are ready. Every field remains editable.")
      );
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : "Character suggestions failed.");
    } finally {
      setSuggestingTarget(null);
    }
  }

  if (activeRole === "caster" || activeRole === "brand") {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center w-full">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-2">Casting view</p>
        <h1 className="reel-title text-3xl">Actor creation is reserved for makers</h1>
        <p className="text-sm text-grey mt-3 mb-6">Switch to Actor Maker from the profile menu to build a new AI actor.</p>
        <Link href="/characters" className="accent-btn inline-flex rounded-full px-5 py-2.5 text-sm font-semibold">Browse actors</Link>
      </div>
    );
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
      router.push(`/characters/${character.id}`);
    } catch (submitError) {
      removeCharacter(character.id);
      setError(submitError instanceof Error ? submitError.message : "The AI actor could not be saved.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 w-full">
      <Link href="/characters" className="text-xs text-grey hover:text-accent">
        ← The Shelf
      </Link>

      <div className="mt-3 mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
          AI Actor Builder
        </p>
        <h1 className="reel-title text-3xl">Bring a new performer to the shelf</h1>
        <p className="text-sm text-grey mt-1">
          Give it a personality and a voice, then leave it live: storytellers will find it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="poster-card rounded-md p-6 flex flex-col gap-5">
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
          <span className="font-medium">Archetype mix</span>
          <span className="text-[11px] text-grey">
            Pick as many as fit. The first one you pick leads; the rest add contradiction.
          </span>
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

        <div className="rounded-md border border-accent/50 bg-accent/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-sm font-semibold">Magic Character</p>
              <p className="mt-1 text-xs text-grey">
                Name the actor, pick the archetype mix, then write a line or two about who they are — Magic Character builds the rest.
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
            <p className="mt-3 text-[11px] text-accent" data-suggest-progress>
              Claude is writing{suggestingTarget === "all" ? " the full identity" : ""}… {elapsedSeconds}s
              {elapsedSeconds > 10 && " — a full identity build usually takes 30–55s, hang tight"}
            </p>
          )}
          {suggestionMessage && (
            <p className="mt-3 text-[11px] text-grey" data-suggestion-message>
              {suggestionMessage}
            </p>
          )}
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
          <details className="rounded-md border border-line bg-paper/40 p-4" data-character-bible open>
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
