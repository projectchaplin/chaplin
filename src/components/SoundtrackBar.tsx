"use client";

import { useState } from "react";

/** Decorative "original score" bar: visual only for now (music wiring comes
 * later); it sells the idea that a story has a soundtrack without needing a
 * real audio file yet. */
export default function SoundtrackBar({ title }: { title: string }) {
  const [playing, setPlaying] = useState(false);
  const bars = [6, 10, 14, 9, 16, 8, 12, 18, 7, 11, 15, 9, 13, 6, 10];

  return (
    <div className="poster-card rounded-md px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => setPlaying((v) => !v)}
        className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
          playing ? "bg-accent border-accent text-paper" : "border-line text-grey hover:border-accent"
        }`}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-grey">Original score</p>
        <p className="text-sm font-medium truncate">{title}</p>
      </div>
      <div className="flex items-end gap-[2px] h-8 shrink-0">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] bg-accent rounded-full ${playing ? "wave-bar" : ""}`}
            style={{
              height: playing ? `${h}px` : "4px",
              animationDelay: `${i * 0.06}s`,
              opacity: playing ? 1 : 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
}
