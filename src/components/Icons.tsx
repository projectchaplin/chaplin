type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconArrowLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M19 12H5" />
      <path d="M11 18 5 12l6-6" />
    </svg>
  );
}

export function IconLock({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

export function IconPlug({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 3v5M15 3v5M7 8h10l-1 4a5 5 0 0 1-5 4 5 5 0 0 1-5-4Z" />
      <path d="M12 16v5" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function IconHome({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

export function IconMask({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="3.3" />
      <path d="M4.5 20c1.2-4.2 4-6.3 7.5-6.3s6.3 2.1 7.5 6.3" />
    </svg>
  );
}

export function IconFilm({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="M9.3 9.3v5.4l4.8-2.7-4.8-2.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBriefcase({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="7.3" width="18" height="11.7" rx="2" />
      <path d="M8.2 7.3V5.6a1.6 1.6 0 0 1 1.6-1.6h4.4a1.6 1.6 0 0 1 1.6 1.6v1.7" />
      <path d="M3 12.6h18" />
    </svg>
  );
}

export function IconReceipt({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8.2h6M9 12h6M9 15.8h3.6" />
    </svg>
  );
}

export function IconTrophy({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4v1.5A3.5 3.5 0 0 0 7 10" />
      <path d="M17 5h3v1.5A3.5 3.5 0 0 1 17 10" />
      <path d="M12 13v3.5" />
      <path d="M9 20.5h6" />
      <path d="M10 17h4l1 3.5H9L10 17z" />
    </svg>
  );
}
