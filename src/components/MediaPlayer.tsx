"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function MediaPlayer({
  src,
  label,
  kind = "audio",
  compact = false,
}: {
  src: string;
  label: string;
  kind?: "audio" | "video";
  compact?: boolean;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    function updateTime() {
      setCurrentTime(media?.currentTime ?? 0);
    }
    function updateDuration() {
      const value = media?.duration ?? 0;
      setDuration(Number.isFinite(value) ? value : 0);
    }
    function stop() {
      setPlaying(false);
    }
    function markFailed() {
      setFailed(true);
      setPlaying(false);
    }

    media.addEventListener("timeupdate", updateTime);
    media.addEventListener("loadedmetadata", updateDuration);
    media.addEventListener("durationchange", updateDuration);
    media.addEventListener("ended", stop);
    media.addEventListener("error", markFailed);
    updateDuration();
    return () => {
      media.removeEventListener("timeupdate", updateTime);
      media.removeEventListener("loadedmetadata", updateDuration);
      media.removeEventListener("durationchange", updateDuration);
      media.removeEventListener("ended", stop);
      media.removeEventListener("error", markFailed);
    };
  }, [src]);

  async function togglePlayback() {
    const media = mediaRef.current;
    if (!media || failed) return;
    if (media.paused) {
      try {
        await media.play();
        setPlaying(true);
      } catch {
        setFailed(true);
      }
    } else {
      media.pause();
      setPlaying(false);
    }
  }

  function seek(value: number) {
    const media = mediaRef.current;
    if (!media || !duration) return;
    media.currentTime = value;
    setCurrentTime(value);
  }

  function toggleMuted() {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }

  const controls = (
    <div className={`flex items-center gap-3 min-w-0 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className={`shrink-0 rounded-full bg-accent text-paper flex items-center justify-center hover:opacity-90 ${compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"}`}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="text-xs font-medium truncate">{label}</span>
          <span className="text-[10px] text-grey tabular-nums whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(currentTime, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label={`Seek ${label}`}
          className="block w-full h-1 accent-accent cursor-pointer"
        />
      </div>
      <button
        type="button"
        onClick={toggleMuted}
        aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
        className="shrink-0 w-8 h-8 rounded-full border border-line text-xs text-grey hover:border-accent hover:text-accent"
      >
        {muted ? "×" : "♪"}
      </button>
    </div>
  );

  return (
    <div data-media-player={kind} className="overflow-hidden rounded-md border border-line bg-black/20 min-w-0">
      {kind === "video" ? (
        <>
          <button type="button" onClick={togglePlayback} className="relative block w-full bg-black" aria-label={playing ? `Pause ${label}` : `Play ${label}`}>
            <video
              ref={(node) => { mediaRef.current = node; }}
              src={src}
              preload="metadata"
              playsInline
              className="w-full aspect-video object-cover"
            />
            {!playing && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="w-12 h-12 rounded-full bg-accent text-paper flex items-center justify-center pl-0.5 shadow-xl">▶</span>
              </span>
            )}
          </button>
          {controls}
        </>
      ) : (
        <>
          <audio ref={(node) => { mediaRef.current = node; }} src={src} preload="metadata" />
          {controls}
        </>
      )}
      {failed && <p className="border-t border-line px-3 py-2 text-[10px] text-red-500">This media could not be played.</p>}
    </div>
  );
}
