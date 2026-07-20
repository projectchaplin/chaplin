import Image from "next/image";
import { hsl, hslSoft } from "@/lib/format";

export default function Avatar({
  hue,
  label,
  size = 40,
  src,
}: {
  hue: number;
  label: string;
  size?: number;
  src?: string;
}) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full border shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        background: hslSoft(hue),
        borderColor: hsl(hue, 45, 60),
        color: hsl(hue, 55, 30),
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={label}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span
          className="reel-title font-bold"
          style={{ fontSize: size * 0.42 }}
        >
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
