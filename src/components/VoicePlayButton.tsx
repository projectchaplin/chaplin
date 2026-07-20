"use client";

import { useEffect, useRef, useState } from "react";

/** Mock voice playback: no real audio yet (wiring comes later), just an
 * animated waveform for the duration of the (fake) clip, so the "characters
 * speak in their own voice" idea is visible without needing ElevenLabs wired
 * up yet. */
export default function VoicePlayButton({
  durationSec = 3,
  label = "Play voice sample",
  compact = false,
}: {
  durationSec?: number;
  label?: string;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function toggle() {
    if (playing) {
      setPlaying(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    setPlaying(true);
    timer.current = setTimeout(() => setPlaying(false), durationSec * 1000);
  }

  const bars = [4, 8, 5, 10, 6, 9, 4];

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full border transition-colors ${
        compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
      } ${playing ? "border-accent bg-accent/10 text-ink" : "border-line hover:border-accent text-grey hover:text-ink"}`}
    >
      <span>{playing ? "❚❚" : "▶"}</span>
      <span className="flex items-end gap-[2px] h-3.5">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-[2.5px] bg-accent rounded-full ${playing ? "wave-bar" : ""}`}
            style={{
              height: playing ? `${h}px` : "3px",
              animationDelay: `${i * 0.08}s`,
              opacity: playing ? 1 : 0.45,
            }}
          />
        ))}
      </span>
      {!compact && <span>{playing ? "Playing…" : label}</span>}
    </button>
  );
}
