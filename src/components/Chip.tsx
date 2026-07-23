import type { CSSProperties } from "react";
import { hsl, hslSoft } from "@/lib/format";

export default function Chip({
  label,
  hue,
  filled = false,
  glass = false,
  compact = false,
}: {
  label: string;
  hue: number;
  filled?: boolean;
  glass?: boolean;
  compact?: boolean;
}) {
  if (glass) {
    return (
      <span
        className={`frost-chip ${filled ? "frost-chip-active" : ""}`}
        style={{ "--chip-hue": hue } as CSSProperties}
      >
        <span aria-hidden="true" className="frost-chip-glint" />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border whitespace-nowrap ${
        compact ? "px-1.5 py-0.5 text-[9px] sm:px-2 sm:text-[11px]" : "px-2 py-0.5 text-[11px]"
      }`}
      style={
        filled
          ? { background: hsl(hue, 55, 42), borderColor: hsl(hue, 55, 42), color: "#fff" }
          : { background: hslSoft(hue), borderColor: hsl(hue, 45, 55), color: hsl(hue, 55, 28) }
      }
    >
      {label}
    </span>
  );
}
