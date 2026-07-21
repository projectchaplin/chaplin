"use client";

import { useEffect, useState } from "react";
import type { Character } from "@/lib/types";

type SoundState = {
  voicePreviewUrl: string | null;
  latestDialogueUrl: string | null;
  latestSfxUrl: string | null;
  latestThemeUrl: string | null;
};

function SoundAsset({
  label,
  description,
  source,
  sourceLabel,
  loading,
  canProduce,
}: {
  label: string;
  description: string;
  source: string | null;
  sourceLabel: string;
  loading: boolean;
  canProduce: boolean;
}) {
  return (
    <div className="border-t border-line first:border-t-0 pt-4 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[11px] text-grey mb-1">{label}</p>
          <p className="text-sm leading-relaxed">{description}</p>
        </div>
        {source && (
          <span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[9px] uppercase tracking-wide text-emerald-500">
            Live from CDN
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-9 max-w-md rounded-full bg-white/[0.05] animate-pulse" />
      ) : source ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <audio controls preload="metadata" src={source} className="w-full sm:max-w-md h-9" />
          <a href={source} target="_blank" rel="noreferrer" className="text-[10px] text-accent hover:underline whitespace-nowrap">
            {sourceLabel} ↗
          </a>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-grey">Not generated yet.</span>
          {canProduce && (
            <a href="#production-studio" className="text-xs text-accent hover:underline">
              Generate in Production Studio →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function CharacterSoundProfile({
  character,
  canProduce,
}: {
  character: Character;
  canProduce: boolean;
}) {
  const [sounds, setSounds] = useState<SoundState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/generate?characterId=${encodeURIComponent(character.id)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Sound profile returned ${response.status}.`);
        return response.json();
      })
      .then((data: { production?: SoundState | null }) => {
        if (!cancelled) setSounds(data.production ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [character.id]);

  const voiceSource = sounds?.latestDialogueUrl ?? sounds?.voicePreviewUrl ?? null;

  return (
    <section id="sound-profile" className="poster-card rounded-md p-5 flex flex-col gap-4 scroll-mt-24">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-grey">Sound profile</h2>
        <p className="text-[11px] text-grey mt-1">Real generated assets attached to this character—not preview animations.</p>
      </div>
      {failed && (
        <p className="rounded-sm bg-red-500/10 px-3 py-2 text-xs text-red-500">
          The persisted sound assets could not be loaded. Refresh to try again.
        </p>
      )}
      <SoundAsset
        label="Voice"
        description={character.voiceDesc}
        source={voiceSource}
        sourceLabel={sounds?.latestDialogueUrl ? "Latest dialogue" : "Locked voice preview"}
        loading={!sounds && !failed}
        canProduce={canProduce}
      />
      <SoundAsset
        label="Signature SFX"
        description={character.sfxDesc}
        source={sounds?.latestSfxUrl ?? null}
        sourceLabel="Latest SFX"
        loading={!sounds && !failed}
        canProduce={canProduce}
      />
      <SoundAsset
        label="Theme score"
        description={character.themeDesc}
        source={sounds?.latestThemeUrl ?? null}
        sourceLabel="Latest theme"
        loading={!sounds && !failed}
        canProduce={canProduce}
      />
    </section>
  );
}
