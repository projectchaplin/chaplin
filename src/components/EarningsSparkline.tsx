import type { LedgerEntry } from "@/lib/types";

export default function EarningsSparkline({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-grey">No earnings yet, not cast into a paid story.</p>;
  }

  const chrono = [...entries].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const max = Math.max(...chrono.map((e) => e.amount), 1);
  const w = 100 / chrono.length;

  return (
    <div className="flex items-end gap-[3px] h-16">
      {chrono.map((entry) => {
        const heightPct = Math.max(10, (entry.amount / max) * 100);
        return (
          <div
            key={entry.id}
            className="flex-1 flex flex-col justify-end group relative"
            style={{ maxWidth: `${w}%` }}
            title={`${entry.type === "tip" ? "Tip" : "Royalty"}: ${entry.amount} reels`}
          >
            <div
              className={`w-full rounded-t-sm ${entry.type === "tip" ? "bg-accent-light" : "bg-accent"}`}
              style={{ height: `${heightPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
