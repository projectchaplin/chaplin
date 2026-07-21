import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminDashboard } from "@/lib/server/supabase-admin";
import AdminRefreshButton from "@/components/AdminRefreshButton";

export const dynamic = "force-dynamic";

const SEEDANCE_ACTIVATION_URL =
  "https://console.byteplus.com/ark/region%3Aark%2Bap-southeast-1/model/detail?Id=seedance-1-5-pro";

function number(value: number | string | null | undefined) {
  return value == null ? 0 : Number(value);
}

function formatUsd(value: number | string | null | undefined) {
  return `$${number(value).toFixed(4)}`;
}

function formatInr(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(number(value));
}

function formatTimestamp(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "—";
}

function StatusDot({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${ready ? "text-emerald-500" : "text-grey"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-grey/40"}`} />
      {label}
    </span>
  );
}

export default async function AdminPage() {
  const role = (await cookies()).get("chaplin-demo-role")?.value ?? "admin";
  if (role !== "admin") redirect("/");
  const data = await getAdminDashboard();
  const voices = new Set(data.voices.filter((voice) => voice.status === "active").map((voice) => voice.character_id));
  const assetsByCharacter = new Map<string, string[]>();
  for (const asset of data.assets) {
    if (!asset.character_id) continue;
    assetsByCharacter.set(asset.character_id, [...(assetsByCharacter.get(asset.character_id) ?? []), asset.kind]);
  }
  const slots = new Map(data.homeSlots.map((slot) => [slot.character_id, slot]));
  const readyCharacters = data.characters.filter((character) => {
    const assets = assetsByCharacter.get(character.id) ?? [];
    return Boolean(character.image_url && character.banner_url && voices.has(character.id) && assets.includes("sfx") && assets.includes("video") && assets.filter((kind) => kind === "gallery").length >= 3);
  });
  const totalUsd = data.jobs.reduce((total, job) => total + number(job.cost_usd), 0);
  const totalInr = data.jobs.reduce((total, job) => total + number(job.cost_inr), 0);
  const totalTokens = data.jobs.reduce((total, job) => total + number(job.normalized_tokens), 0);
  const costedJobs = data.jobs.filter((job) => job.cost_usd != null).length;
  const latestSeedanceJob = data.jobs.find((job) => job.model === "seedance-1-5-pro-251215");
  const seedanceNeedsActivation =
    latestSeedanceJob?.status === "failed" &&
    /not activated|activate the model/i.test(latestSeedanceJob.error_message ?? "");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-semibold mb-2">Content operations</p>
          <h1 className="marquee-title text-3xl sm:text-5xl leading-tight break-words">ADMIN CONTROL ROOM</h1>
          <p className="text-sm text-grey mt-2 max-w-2xl">See what exists, what is missing, and which characters are ready to earn a position on the homepage.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <AdminRefreshButton />
          <Link href="/characters/new" className="accent-btn rounded-full px-5 py-2.5 text-sm font-semibold">+ Create character</Link>
        </div>
      </div>

      {seedanceNeedsActivation && (
        <div className="mb-8 rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-500">Video pipeline action required</p>
            <p className="text-xs text-grey mt-1">
              Seedance 1.5 Pro is configured, but BytePlus has not activated it for this account. The failed request remains recorded below with its trace ID.
            </p>
          </div>
          <a
            href={SEEDANCE_ACTIVATION_URL}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full border border-amber-500 px-4 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10"
          >
            Activate in BytePlus ↗
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ["Characters", data.characters.length],
          ["Homepage ready", readyCharacters.length],
          ["Media assets", data.assets.length],
          ["Generation jobs", data.jobs.length],
        ].map(([label, value]) => (
          <div key={label} className="poster-card rounded-md p-4 min-w-0">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-[11px] uppercase tracking-wide text-grey mt-1 break-words">{label}</p>
          </div>
        ))}
      </div>

      <section className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="reel-title text-2xl">Generation spend</h2>
            <p className="text-xs text-grey mt-1">Voice and media APIs bill in characters, credits, seconds, or images—not LLM tokens. Chaplin tokens normalize spend at 1,000 tokens per US dollar while every provider-native unit remains visible.</p>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-grey">{costedJobs}/{data.jobs.length} jobs costed</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["USD burned", formatUsd(totalUsd)],
            ["INR burned", formatInr(totalInr)],
            ["Chaplin tokens", Math.round(totalTokens).toLocaleString("en-IN")],
            ["FX used", data.jobs.find((job) => job.usd_to_inr_rate)?.usd_to_inr_rate ? `₹${number(data.jobs.find((job) => job.usd_to_inr_rate)?.usd_to_inr_rate).toFixed(2)} / $1` : "Waiting"],
          ].map(([label, value]) => (
            <div key={label} className="poster-card rounded-md p-4 min-w-0">
              <p className="text-xl sm:text-2xl font-semibold break-words">{value}</p>
              <p className="text-[10px] uppercase tracking-wide text-grey mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="reel-title text-2xl">Character readiness</h2>
            <p className="text-xs text-grey mt-1">A homepage-ready character needs identity art, a locked voice, signature SFX, at least three gallery stills, and a video.</p>
          </div>
          <span className="text-xs text-grey">{readyCharacters.length}/{data.characters.length} ready</span>
        </div>

        <div className="overflow-x-auto max-w-full poster-card rounded-md">
          <table className="w-full min-w-[920px] text-left">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-grey border-b border-line">
              <tr>
                <th className="px-4 py-3">Character</th>
                <th className="px-3 py-3">Identity</th>
                <th className="px-3 py-3">Voice</th>
                <th className="px-3 py-3">SFX</th>
                <th className="px-3 py-3">Gallery</th>
                <th className="px-3 py-3">Video</th>
                <th className="px-3 py-3">Home</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.characters.map((character) => {
                const assetKinds = assetsByCharacter.get(character.id) ?? [];
                const identityReady = Boolean(character.image_url && character.banner_url);
                const voiceReady = voices.has(character.id);
                const sfxReady = assetKinds.includes("sfx");
                const galleryCount = assetKinds.filter((kind) => kind === "gallery").length;
                const videoReady = assetKinds.includes("video");
                const slot = slots.get(character.id);
                return (
                  <tr key={character.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-sm">{character.name}</p>
                      <p className="text-[11px] text-grey">{character.archetype} · {character.license_type}</p>
                    </td>
                    <td className="px-3"><StatusDot ready={identityReady} label={identityReady ? "Ready" : "Missing"} /></td>
                    <td className="px-3"><StatusDot ready={voiceReady} label={voiceReady ? "Locked" : "Create"} /></td>
                    <td className="px-3"><StatusDot ready={sfxReady} label={sfxReady ? "Ready" : "Create"} /></td>
                    <td className="px-3"><StatusDot ready={galleryCount >= 3} label={`${galleryCount}/3`} /></td>
                    <td className="px-3"><StatusDot ready={videoReady} label={videoReady ? "Ready" : "Create"} /></td>
                    <td className="px-3">
                      <span className={`text-[10px] uppercase tracking-wide rounded-full border px-2 py-1 ${slot?.status === "published" ? "border-emerald-500 text-emerald-500" : "border-line text-grey"}`}>
                        {slot ? `${slot.position}. ${slot.status}` : "Not placed"}
                      </span>
                    </td>
                    <td className="px-4 text-right">
                      <Link href={`/characters/${character.id}`} className="text-xs text-accent hover:underline">Open production →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="poster-card rounded-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="reel-title text-xl">Homepage queue</h2>
            <span className="text-[10px] uppercase tracking-wide text-grey">Position order</span>
          </div>
          <div className="flex flex-col divide-y divide-line">
            {data.homeSlots.map((slot) => {
              const character = data.characters.find((item) => item.id === slot.character_id);
              return (
                <div key={slot.character_id} className="flex items-center gap-3 py-3">
                  <span className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold">{slot.position}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{character?.name ?? slot.character_id}</p>
                    <p className="text-[11px] text-grey truncate">{slot.editorial_note ?? "No editorial note"}</p>
                  </div>
                  <span className="text-[10px] uppercase text-grey">{slot.status}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="poster-card rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="reel-title text-xl">Recent generation activity</h2>
            <span className="text-[10px] uppercase tracking-wide text-grey">Complete history · {data.jobs.length} events</span>
          </div>
          {data.jobs.length === 0 ? (
            <div className="border border-dashed border-line rounded-md px-4 py-8 text-center">
              <p className="text-sm">No generated assets yet</p>
              <p className="text-xs text-grey mt-1">Voice, SFX, image, and video jobs will appear here automatically.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.jobs.map((job, index) => {
                const character = data.characters.find((item) => item.id === job.character_id);
                const asset = data.assets.find((item) => item.id === job.output_asset_id);
                const runtimeMs = job.started_at && job.completed_at
                  ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
                  : null;
                return (
                  <details key={job.id} open={index < 3} className="border border-line rounded-md group">
                    <summary className="list-none cursor-pointer p-3 sm:p-4 grid sm:grid-cols-[auto_1fr_auto] gap-3 items-start">
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
                    <div className="border-t border-line p-3 sm:p-4 text-xs">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
                      <div className="grid lg:grid-cols-2 gap-4">
                        <div className="space-y-3 min-w-0">
                          <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Prompt / input</p><p className="whitespace-pre-wrap break-words">{job.prompt ?? "No prompt stored"}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Usage</p><pre className="text-[11px] whitespace-pre-wrap break-words bg-black/20 rounded-sm p-2 overflow-x-auto">{JSON.stringify(job.usage ?? {}, null, 2)}</pre></div>
                        </div>
                        <div className="space-y-3 min-w-0">
                          <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Pricing explanation</p><p className="break-words">{job.pricing_note ?? "This historical job predates cost instrumentation."}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Trace</p><p className="break-all">Job {job.id}</p><p className="break-all text-grey">Request {job.provider_request_id ?? "not returned"}</p></div>
                          {asset && <div><p className="text-[10px] uppercase tracking-wide text-grey mb-1">Output asset</p><a href={asset.url} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">Open CDN asset ↗</a></div>}
                          {job.error_message && <div className="bg-red-500/10 text-red-500 rounded-sm p-3 break-words"><p className="text-[10px] uppercase tracking-wide mb-1">Error</p>{job.error_message}</div>}
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
