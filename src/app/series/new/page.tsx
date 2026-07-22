"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useChaplinStore } from "@/lib/store";

type ShotDraft = {
  beat: string;
  visualAction: string;
  cameraDirection: string;
  lightingDirection: string;
  dialogue: string;
  audioDirection: string;
};

const BEATS = [
  "Pattern-break hook", "Immediate consequence", "Actor makes a choice", "Obstacle answers",
  "New information", "Pressure closes in", "False win", "Cost of the win",
  "Irreversible move", "Truth is exposed", "Apparent resolution", "Cliffhanger reversal",
];

function emptyShots(): ShotDraft[] {
  return BEATS.map((beat) => ({
    beat,
    visualAction: "",
    cameraDirection: "",
    lightingDirection: "",
    dialogue: "",
    audioDirection: "",
  }));
}

export default function NewSeriesPage() {
  const router = useRouter();
  const characters = useChaplinStore((state) => state.characters);
  const ownerId = useChaplinStore((state) => state.currentUserId);
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [premise, setPremise] = useState("");
  const [genre, setGenre] = useState("Micro-thriller");
  const [language, setLanguage] = useState("Hindi");
  const [secondaryLanguage, setSecondaryLanguage] = useState("English");
  const [castIds, setCastIds] = useState<string[]>([]);
  const [audiencePromise, setAudiencePromise] = useState("");
  const [centralConflict, setCentralConflict] = useState("");
  const [seasonQuestion, setSeasonQuestion] = useState("");
  const [escalationRule, setEscalationRule] = useState("");
  const [cliffhangerRule, setCliffhangerRule] = useState("");
  const [tone, setTone] = useState("");
  const [pilotTitle, setPilotTitle] = useState("Episode 1 — The interruption");
  const [pilotLogline, setPilotLogline] = useState("");
  const [openingHook, setOpeningHook] = useState("");
  const [episodeObjective, setEpisodeObjective] = useState("");
  const [cliffhanger, setCliffhanger] = useState("");
  const [shots, setShots] = useState<ShotDraft[]>(emptyShots);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cast = useMemo(() => castIds.map((id) => characters.find((character) => character.id === id)).filter(Boolean), [castIds, characters]);

  function toggleCast(id: string) {
    setCastIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  }

  function buildShotPlan() {
    const lead = cast[0]?.name ?? "The lead actor";
    const world = premise.trim() || logline.trim() || "a familiar place interrupted by one impossible event";
    const conflict = centralConflict.trim() || "the lead's urgent goal collides with the one rule they refuse to break";
    const ending = cliffhanger.trim() || cliffhangerRule.trim() || "the apparent solution reveals a more dangerous observer";
    setOpeningHook((value) => value || `Open on ${lead} already reacting to a consequence before the audience knows its cause.`);
    setEpisodeObjective((value) => value || `${lead} must make one visible, irreversible choice inside ${world}.`);
    setCliffhanger((value) => value || ending);
    setPilotLogline((value) => value || `${lead} tries to regain control, but ${conflict}.`);
    setShots(BEATS.map((beat, index) => ({
      beat,
      visualAction: [
        `${lead} enters mid-action; a single foreground detail proves something has just gone wrong.`,
        `The environment answers the interruption physically; ${lead} contains the reaction instead of explaining it.`,
        `${lead} chooses the harder path and crosses a clear threshold in frame.`,
        `The obstacle blocks that choice with a visible counter-move from the opposite screen direction.`,
        `A close detail changes what the audience believes; ${lead}'s eyeline lands before the reveal.`,
        `Space compresses around ${lead}; hands, breath, and weight show the pressure rising.`,
        `${lead} completes the plan and earns one clean beat of relief.`,
        `The success creates an immediate cost in the background while ${lead} has not noticed yet.`,
        `${lead} notices and commits to an action that cannot be taken back.`,
        `The central truth becomes visible through an object or entrance, never an explanation.`,
        `${lead} appears to restore control and turns toward the exit.`,
        `Before the exit completes, ${ending}; cut on ${lead}'s smallest readable reaction.`,
      ][index],
      cameraDirection: ["24mm low wide, locked for the first second, then a short push-in", "35mm shoulder-height lateral track", "40mm medium profile with decisive screen direction", "50mm opposing over-shoulder", "85mm insert to eye-line match", "50mm slow handheld compression", "35mm centered medium", "28mm deep-focus reveal", "40mm controlled push-in", "65mm rack focus from evidence to face", "35mm brief symmetrical hold", "85mm close-up, no camera move after the reveal"][index],
      lightingDirection: index < 4 ? "Motivated hard side key from frame left; restrained cool fill; practical edge behind the actor" : index < 8 ? "Keep the same key direction; reduce fill one stop as pressure rises; preserve skin tone" : "Preserve key direction and wardrobe color; let the background practical intensify toward the final reversal",
      dialogue: index === 2 ? `${lead}: “Then we do it the difficult way.”` : index === 11 ? `${lead}: “You were supposed to be gone.”` : "",
      audioDirection: index === 0 ? "Begin on one hard transient, then drop to room tone." : index === 11 ? "Resolve the theme into an unfinished two-note sting; hard cut before release." : "Continue restrained room tone and one story-world texture; no wall-to-wall music.",
    })));
  }

  function updateShot(index: number, field: keyof ShotDraft, value: string) {
    setShots((current) => current.map((shot, shotIndex) => shotIndex === index ? { ...shot, [field]: value } : shot));
  }

  async function saveSeries() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId, title, logline, premise, genre, primaryLanguage: language, secondaryLanguage,
          storyEngine: { audiencePromise, centralConflict, seasonQuestion, escalationRule, cliffhangerRule, tone, brandBoundaries: [] },
          cast: castIds.map((characterId, index) => ({
            characterId,
            roleName: index === 0 ? "Lead" : `Principal ${index + 1}`,
            continuityNotes: "Use the locked face, voice, wardrobe, movement, and signature audio from the actor production bible.",
          })),
          pilot: { title: pilotTitle, logline: pilotLogline, openingHook, episodeObjective, cliffhanger, shots },
        }),
      });
      const data = await response.json() as { series?: { id: string }; error?: string };
      if (!response.ok || !data.series) throw new Error(data.error || "Could not create the series.");
      router.push(`/series/${data.series.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create the series.");
    } finally {
      setBusy(false);
    }
  }

  const field = "min-w-0 w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none";
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href="/series" className="text-xs text-grey hover:text-accent">← Production slate</Link>
      <div className="mt-4 mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Series story engine</p>
        <h1 className="marquee-title mt-2 text-4xl sm:text-5xl">BUILD THE PILOT BEFORE THE PIXELS</h1>
        <p className="mt-3 max-w-3xl text-sm text-grey">A pilot is locked to 60 seconds: twelve five-second shots, one evolving conflict, and a cliffhanger that creates the next episode.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="poster-card rounded-lg p-5">
          <h2 className="reel-title text-2xl">1. Series promise</h2>
          <div className="mt-4 grid gap-3">
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Series title" />
            <textarea className={field} rows={2} value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="One-sentence logline" />
            <textarea className={field} rows={4} value={premise} onChange={(e) => setPremise(e.target.value)} placeholder="What repeats every episode, and why will viewers return?" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input className={field} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" />
              <input className={field} value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Primary language" />
              <input className={field} value={secondaryLanguage} onChange={(e) => setSecondaryLanguage(e.target.value)} placeholder="Second language" />
            </div>
          </div>
        </section>

        <section className="poster-card rounded-lg p-5">
          <div className="flex items-end justify-between gap-3"><h2 className="reel-title text-2xl">2. Recurring engine</h2><span className="text-[10px] uppercase text-grey">not biography</span></div>
          <div className="mt-4 grid gap-3">
            <input className={field} value={audiencePromise} onChange={(e) => setAudiencePromise(e.target.value)} placeholder="Audience promise — what feeling repeats?" />
            <input className={field} value={centralConflict} onChange={(e) => setCentralConflict(e.target.value)} placeholder="Central conflict" />
            <input className={field} value={seasonQuestion} onChange={(e) => setSeasonQuestion(e.target.value)} placeholder="Season question" />
            <input className={field} value={escalationRule} onChange={(e) => setEscalationRule(e.target.value)} placeholder="How each win creates a bigger cost" />
            <input className={field} value={cliffhangerRule} onChange={(e) => setCliffhangerRule(e.target.value)} placeholder="What kind of reversal ends each episode" />
            <input className={field} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tone and pacing rule" />
          </div>
        </section>
      </div>

      <section className="poster-card mt-5 rounded-lg p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="reel-title text-2xl">3. Lock the cast</h2><p className="mt-1 text-xs text-grey">One to four actors. Their production bibles govern every shot.</p></div>
          <span className="text-xs text-accent">{castIds.length}/4 selected</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {characters.map((character) => (
            <button key={character.id} type="button" onClick={() => toggleCast(character.id)} className={`rounded-md border p-3 text-left ${castIds.includes(character.id) ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}>
              <span className="block font-semibold">{character.name}</span><span className="mt-1 block text-[10px] uppercase text-grey">{character.archetype}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="poster-card mt-5 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="reel-title text-2xl">4. Pilot: 12 × 5 seconds</h2><p className="mt-1 text-xs text-grey">Each shot must change information, pressure, or choice.</p></div>
          <button type="button" onClick={buildShotPlan} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">✦ Build production plan</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <input className={field} value={pilotTitle} onChange={(e) => setPilotTitle(e.target.value)} placeholder="Pilot title" />
          <input className={field} value={pilotLogline} onChange={(e) => setPilotLogline(e.target.value)} placeholder="Pilot logline" />
          <textarea className={field} rows={2} value={openingHook} onChange={(e) => setOpeningHook(e.target.value)} placeholder="Opening visual hook" />
          <textarea className={field} rows={2} value={episodeObjective} onChange={(e) => setEpisodeObjective(e.target.value)} placeholder="Irreversible episode objective" />
          <textarea className={`${field} sm:col-span-2 border-accent/50`} rows={2} value={cliffhanger} onChange={(e) => setCliffhanger(e.target.value)} placeholder="Mandatory situation-changing cliffhanger" />
        </div>

        <div className="mt-6 grid gap-3">
          {shots.map((shot, index) => (
            <details key={index} className="rounded-md border border-line bg-paper/50 p-3" open={index === 0 || index === 11}>
              <summary className="cursor-pointer list-none text-sm font-semibold"><span className="mr-3 text-accent">{String(index + 1).padStart(2, "0")} · {index * 5}–{(index + 1) * 5}s</span>{shot.beat}</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className={field} value={shot.beat} onChange={(e) => updateShot(index, "beat", e.target.value)} placeholder="Dramatic beat" />
                <input className={field} value={shot.dialogue} onChange={(e) => updateShot(index, "dialogue", e.target.value)} placeholder="Dialogue, only if needed" />
                <textarea className={`${field} sm:col-span-2`} rows={2} value={shot.visualAction} onChange={(e) => updateShot(index, "visualAction", e.target.value)} placeholder="Visible action and performance" />
                <textarea className={field} rows={2} value={shot.cameraDirection} onChange={(e) => updateShot(index, "cameraDirection", e.target.value)} placeholder="Camera, angle, lens, movement" />
                <textarea className={field} rows={2} value={shot.lightingDirection} onChange={(e) => updateShot(index, "lightingDirection", e.target.value)} placeholder="Motivated lighting direction" />
                <textarea className={`${field} sm:col-span-2`} rows={2} value={shot.audioDirection} onChange={(e) => updateShot(index, "audioDirection", e.target.value)} placeholder="Voice, SFX, theme, room tone" />
              </div>
            </details>
          ))}
        </div>
      </section>

      {error && <p className="mt-5 rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">{error}</p>}
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-grey">Saving creates a persistent series, pilot episode, cast lock, and continuity chain in Supabase.</p>
        <button type="button" onClick={saveSeries} disabled={busy} className="accent-btn shrink-0 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-50">{busy ? "Saving the slate…" : "Create series + pilot"}</button>
      </div>
    </main>
  );
}
