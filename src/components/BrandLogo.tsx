import Image from "next/image";
import type { HTMLAttributes } from "react";

export default function BrandLogo({
  className = "",
  priority = false,
  size = "header",
  ...props
}: {
  priority?: boolean;
  size?: "header" | "footer";
} & HTMLAttributes<HTMLSpanElement>) {
  const compact = size === "footer";

  return (
    <span
      role="img"
      aria-label="Chaplin"
      {...props}
      className={`inline-flex shrink-0 items-center text-white ${compact ? "gap-1.5" : "gap-2"} ${className}`}
    >
      <Image
        src="/brand/chaplin-mark.png"
        alt=""
        aria-hidden="true"
        width={compact ? 28 : 36}
        height={compact ? 28 : 36}
        priority={priority}
        sizes={compact ? "28px" : "36px"}
        className={compact ? "h-7 w-7 object-contain" : "h-9 w-9 object-contain"}
      />
      <span
        aria-hidden="true"
        className={`font-display font-black leading-none tracking-[0.08em] ${compact ? "text-sm" : "text-lg"}`}
      >
        CHAPLIN
      </span>
    </span>
  );
}
