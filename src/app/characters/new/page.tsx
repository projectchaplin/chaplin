"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChaplinStore } from "@/lib/store";
import Avatar from "@/components/Avatar";
import Chip from "@/components/Chip";
import { ARCHETYPES } from "@/data/seed";
import type { Archetype, LicenseType } from "@/lib/types";
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

export default function NewCharacterPage() {
  const router = useRouter();
  const currentUserId = useChaplinStore((s) => s.currentUserId);
  const addCharacter = useChaplinStore((s) => s.addCharacter);

  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState<Archetype>("hero");
  const [tagline, setTagline] = useState("");
  const [personality, setPersonality] = useState("");
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

  const isCustomVoice = voicePreset === VOICE_PRESETS[VOICE_PRESETS.length - 1];
  const voiceDesc = isCustomVoice ? customVoice : voicePreset;
  const isCustomSfx = sfxPreset === SFX_PRESETS[SFX_PRESETS.length - 1];
  const sfxDesc = isCustomSfx ? customSfx : sfxPreset;
  const isCustomScore = scorePreset === SCORE_PRESETS[SCORE_PRESETS.length - 1];
  const themeDesc = isCustomScore ? customScore : scorePreset;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !name.trim() ||
      !tagline.trim() ||
      !personality.trim() ||
      !voiceDesc.trim() ||
      !sfxDesc.trim() ||
      !themeDesc.trim()
    ) {
      setError("Every field earns this character its place on the shelf, fill them all in.");
      return;
    }
    const character = addCharacter({
      makerId: currentUserId,
      name: name.trim(),
      archetype,
      tagline: tagline.trim(),
      personality: personality.trim(),
      voiceDesc: voiceDesc.trim(),
      sfxDesc: sfxDesc.trim(),
      themeDesc: themeDesc.trim(),
      avatarHue: hue,
      licenseType,
      royaltyRate,
    });
    router.push(`/characters/${character.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 w-full">
      <Link href="/characters" className="text-xs text-grey hover:text-accent">
        ← The Shelf
      </Link>

      <div className="mt-3 mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold mb-1">
          Character Builder
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ferra Voss"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Archetype</span>
          <div className="flex flex-wrap gap-1.5">
            {ARCHETYPES.map((a) => (
              <button type="button" key={a} onClick={() => setArchetype(a)}>
                <Chip
                  label={ARCHETYPE_LABEL[a]}
                  hue={ARCHETYPE_HUE[a]}
                  filled={archetype === a}
                />
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tagline</span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line that sells the pitch"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Personality</span>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={3}
            placeholder="How they talk, what they want, what sets them off"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-accent resize-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Voice</span>
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
              value={customVoice}
              onChange={(e) => setCustomVoice(e.target.value)}
              placeholder="Describe the voice yourself"
              className="border border-line rounded-sm px-3 py-2 mt-1 focus:outline-none focus:border-accent"
            />
          )}
          <span className="text-[11px] text-grey">
            Real voice generation wires in later, this describes it for now.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Signature SFX</span>
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
              value={customSfx}
              onChange={(e) => setCustomSfx(e.target.value)}
              placeholder="Describe the signature sound yourself"
              className="border border-line rounded-sm px-3 py-2 mt-1 focus:outline-none focus:border-accent"
            />
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Theme score</span>
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
              value={customScore}
              onChange={(e) => setCustomScore(e.target.value)}
              placeholder="Describe the theme yourself"
              className="border border-line rounded-sm px-3 py-2 mt-1 focus:outline-none focus:border-accent"
            />
          )}
          <span className="text-[11px] text-grey">
            Real music generation wires in later, this describes it for now.
          </span>
        </label>

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

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          className="bg-accent text-paper font-semibold px-4 py-3 rounded-sm hover:bg-accent-light transition-colors"
        >
          Put {name.trim() || "this character"} on the shelf
        </button>
      </form>
    </div>
  );
}
