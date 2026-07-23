import { redirect } from "next/navigation";
import AdminPipelineLab from "@/components/AdminPipelineLab";
import AdminRefreshButton from "@/components/AdminRefreshButton";
import AdminSectionNav from "@/components/AdminSectionNav";
import { getServerAuthIdentity } from "@/lib/server/auth";
import { getPipelineConfig } from "@/lib/server/pipeline-config";
import { getAdminDashboard } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage() {
  const identity = await getServerAuthIdentity();
  if (identity?.role !== "admin") redirect("/admin/login?next=/admin/pipeline");

  const [config, dashboard] = await Promise.all([
    getPipelineConfig(),
    getAdminDashboard(),
  ]);
  const assets = new Map(dashboard.assets.map((asset) => [asset.id, asset.url]));
  const recentRuns = dashboard.jobs.slice(0, 80).map((job) => ({
    id: job.id,
    kind: job.kind,
    provider: job.provider,
    model: job.model,
    status: job.status,
    prompt: job.prompt,
    costUsd: job.cost_usd == null ? null : Number(job.cost_usd),
    createdAt: job.created_at,
    outputUrl: job.output_asset_id ? assets.get(job.output_asset_id) ?? null : null,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-semibold mb-2">Super Admin · Production system</p>
          <h1 className="marquee-title text-3xl sm:text-5xl leading-tight">PIPELINE LAB</h1>
          <p className="text-sm text-grey mt-2 max-w-3xl">
            Tune every creative stage, inspect its effective provider request, review real outputs and costs, then activate one version across Chaplin.
          </p>
        </div>
        <AdminRefreshButton />
      </div>

      <AdminSectionNav />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ["Active revision", config.revision],
          ["Enabled stages", Object.values(config.stages).filter((stage) => stage.enabled).length],
          ["Pipeline stages", Object.keys(config.stages).length],
          ["Recorded runs", dashboard.jobs.length],
        ].map(([label, value]) => (
          <div key={label} className="poster-card rounded-md p-4 min-w-0">
            <p className="text-xl sm:text-2xl font-semibold">{value}</p>
            <p className="text-[10px] uppercase tracking-wide text-grey mt-1">{label}</p>
          </div>
        ))}
      </div>

      <AdminPipelineLab
        initialConfig={config}
        recentRuns={recentRuns}
        imageProviderReadiness={{
          byteplus: Boolean(process.env.SEEDANCE_API_KEY ?? process.env.SEEDREAM_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
        }}
      />
    </div>
  );
}
