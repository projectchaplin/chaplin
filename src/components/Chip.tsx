import { hsl, hslSoft } from "@/lib/format";

export default function Chip({
  label,
  hue,
  filled = false,
}: {
  label: string;
  hue: number;
  filled?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap"
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
