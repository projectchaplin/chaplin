import type { AdminAssetRow, AdminCharacterRow, AdminJobRow } from "@/lib/server/supabase-admin";

function number(value: number | string | null | undefined) {
  return value == null ? 0 : Number(value);
}

function formatUsd(value: number | string | null | undefined) {
  return `$${number(value).toFixed(4)}`;
}

function formatInr(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(number(value));
}

function formatTimestamp(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
    : "—";
}

export default function AdminGenerationLogList({
  jobs,
  assets,
  characters,
}: {
  jobs: AdminJobRow[];
  assets: AdminAssetRow[];
  characters: AdminCharacterRow[];
}) {
  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-md px-4 py-12 text-center">
        <p className="text-sm">No generation events yet</p>
        <p className="text-xs text-grey mt-1">Voice, SFX, image, and video jobs will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-admin-generation-logs>
      {jobs.map((job, index) => {
        const character = characters.find((item) => item.id === job.character_id);
        const asset = assets.find((item) => item.id === job.output_asset_id);
        const runtimeMs = job.started_at && job.completed_at
          ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
          : null;
        return (
          <details key={job.id} open={index < 3} className="poster-card rounded-md group overflow-hidden">
            <summary className="list-none cursor-pointer p-4 sm:p-5 grid sm:grid-cols-[auto_1fr_auto] gap-3 items-start hover:bg-white/[0.025]">
              <span className={`w-2 h-2 mt-1.5 rounded-full ${job.status === "succeeded" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : "bg-amber-400"}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <strong className="text-sm capitalize">{job.kind}</strong>
                  <span className="text-[10px] uppercase tracking-wide text-grey">{job.status}</span>
                  <span className="text-[11px] text-grey">{character?.name ?? job.character_id ?? "System"}</span>
                </span>
                <span className="block text-[11px] text-grey mt-1 break-words">{job.provider} · {job.model} · {formatTimestamp(job.created_at)}</span>
              </span>
              <span className="grid grid-cols-3 gap-3 text-right text-[11px] whitespace-nowrap">
                <span><b className="block text-ink">{job.normalized_tokens == null ? "—" : Math.round(number(job.normalized_tokens))}</b><span className="text-grey">tokens</span></span>
                <span><b className="block text-ink">{job.cost_usd == null ? "—" : formatUsd(job.cost_usd)}</b><span className="text-grey">USD</span></span>
                <span><b className="block text-ink">{job.cost_inr == null ? "—" : formatInr(job.cost_inr)}</b><span className="text-grey">INR</span></span>
              </span>
            </summary>
            <div className="border-t border-line p-4 sm:p-5 text-xs">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  ["Provider credits", job.provider_credits ?? "Not returned"],
                  ["Runtime", runtimeMs == null ? "—" : `${(runtimeMs / 1000).toFixed(2)}s`],
                  ["FX rate", job.usd_to_inr_rate == null ? "—" : `₹${number(job.usd_to_inr_rate).toFixed(4)} / $1`],
                  ["Cost method", job.cost_method ?? "Historical / unavailable"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/[0.03] rounded-sm p-3 min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-grey">{label}</p>
                    <p className="mt-1 break-words">{String(value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-5">
                <div className="space-y-3 min-w-0">
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Prompt / input</p><p className="whitespace-pre-wrap break-words">{job.prompt ?? "No prompt stored"}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Usage</p><pre className="text-[11px] whitespace-pre-wrap break-words bg-black/20 rounded-sm p-2 overflow-x-auto">{JSON.stringify(job.usage ?? {}, null, 2)}</pre></div>
                </div>
                <div className="space-y-3 min-w-0">
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Pricing explanation</p><p className="break-words">{job.pricing_note ?? "This historical job predates cost instrumentation."}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Trace</p><p className="break-all">Job {job.id}</p><p className="break-all text-grey">Request {job.provider_request_id ?? "not returned"}</p></div>
                  {Object.keys(job.metadata ?? {}).length > 0 && <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Generation metadata</p><pre className="text-[11px] whitespace-pre-wrap break-words bg-black/20 rounded-sm p-2 overflow-x-auto">{JSON.stringify(job.metadata, null, 2)}</pre></div>}
                  {asset && <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Output asset</p><a href={asset.url} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">Open CDN asset ↗</a></div>}
                  {job.error_message && <div className="bg-red-500/10 text-red-500 rounded-sm p-3 break-words"><p className="text-[10px] uppercase tracking-wide mb-1">Error</p>{job.error_message}</div>}
                </div>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
