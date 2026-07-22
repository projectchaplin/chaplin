import { redirect } from "next/navigation";
import AdminGenerationLogList from "@/components/AdminGenerationLogList";
import AdminRefreshButton from "@/components/AdminRefreshButton";
import AdminSectionNav from "@/components/AdminSectionNav";
import { getAdminDashboard } from "@/lib/server/supabase-admin";
import { getServerAuthIdentity } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function number(value: number | string | null | undefined) {
  return value == null ? 0 : Number(value);
}

export default async function AdminLogsPage() {
  const identity = await getServerAuthIdentity();
  if (identity?.role !== "admin") redirect("/auth?next=/admin/logs");
  const data = await getAdminDashboard();
  const succeeded = data.jobs.filter((job) => job.status === "succeeded").length;
  const failed = data.jobs.filter((job) => job.status === "failed").length;
  const totalUsd = data.jobs.reduce((total, job) => total + number(job.cost_usd), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-semibold mb-2">Platform observability</p>
          <h1 className="marquee-title text-3xl sm:text-5xl leading-tight">GENERATION LOGS</h1>
          <p className="text-sm text-grey mt-2 max-w-2xl">Every provider request, output, error, token equivalent, and cost in one dedicated operational history.</p>
        </div>
        <AdminRefreshButton />
      </div>

      <AdminSectionNav />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ["All events", data.jobs.length],
          ["Succeeded", succeeded],
          ["Failed", failed],
          ["Total USD", `$${totalUsd.toFixed(4)}`],
        ].map(([label, value]) => (
          <div key={label} className="poster-card rounded-md p-4 min-w-0">
            <p className="text-xl sm:text-2xl font-semibold break-words">{value}</p>
            <p className="text-[10px] uppercase tracking-wide text-grey mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="reel-title text-xl sm:text-2xl">Complete history</h2>
        <span className="text-[10px] uppercase tracking-wide text-grey">Newest first · {data.jobs.length} events</span>
      </div>
      <AdminGenerationLogList jobs={data.jobs} assets={data.assets} characters={data.characters} />
    </div>
  );
}
