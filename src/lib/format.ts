export function hsl(hue: number, sat = 55, light = 42) {
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export function hslSoft(hue: number) {
  return `hsl(${hue} 45% 92%)`;
}

export function money(amount: number) {
  return `${amount.toLocaleString("en-IN")} reels`;
}

export function compactNumber(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const now = new Date("2026-07-20T12:00:00Z").getTime();
  const diffDays = Math.max(0, Math.round((now - then) / 86400000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.round(diffDays / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export const ARCHETYPE_LABEL: Record<string, string> = {
  villain: "Villain",
  mentor: "Mentor",
  "love-interest": "Love Interest",
  "comic-relief": "Comic Relief",
  hero: "Hero",
  superhero: "Superhero",
  horror: "Horror",
  rebel: "Rebel",
  sidekick: "Sidekick",
  outsider: "Outsider",
};

export const LICENSE_LABEL: Record<string, string> = {
  open: "Open, free to cast",
  paid: "Paid, royalty per casting",
  approval: "Approval, maker signs off",
};

export const ARCHETYPE_HUE: Record<string, number> = {
  villain: 350,
  mentor: 35,
  "love-interest": 320,
  "comic-relief": 45,
  hero: 205,
  superhero: 42,
  horror: 275,
  rebel: 225,
  sidekick: 150,
  outsider: 265,
};

export const LICENSE_HUE: Record<string, number> = {
  open: 150,
  paid: 38,
  approval: 210,
};
