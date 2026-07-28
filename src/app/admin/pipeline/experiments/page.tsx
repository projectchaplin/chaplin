import { redirect } from "next/navigation";
import AdminRefreshButton from "@/components/AdminRefreshButton";
import AdminSectionNav from "@/components/AdminSectionNav";
import PipelineExperimentGround from "@/components/PipelineExperimentGround";
import { getServerAuthIdentity } from "@/lib/server/auth";
import { listPipelineExperiments } from "@/lib/server/pipeline-experiments";
import { getAdminDashboard } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PipelineExperimentsPage() {
  const identity = await getServerAuthIdentity();
  if (identity?.role !== "admin") redirect("/super-admin?next=/admin/pipeline/experiments");

  const [experiments, dashboard] = await Promise.all([
    listPipelineExperiments(),
    getAdminDashboard(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Super Admin · Creative engineering</p>
          <h1 className="marquee-title text-3xl leading-tight sm:text-5xl">EXPERIMENT GROUND</h1>
          <p className="mt-2 max-w-3xl text-sm text-grey">
            Fork production, run identical briefs through controlled variants, compare the actual outputs, and promote only the tested winner.
          </p>
        </div>
        <AdminRefreshButton />
      </div>

      <AdminSectionNav />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Experiments", experiments.length],
          ["In review", experiments.filter((item) => item.status === "review").length],
          ["Real test runs", experiments.reduce((total, item) => total + item.results.length, 0)],
          ["Promoted winners", experiments.filter((item) => item.status === "promoted").length],
        ].map(([label, value]) => (
          <div key={label} className="poster-card min-w-0 rounded-md p-4">
            <p className="text-xl font-semibold sm:text-2xl">{value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-grey">{label}</p>
          </div>
        ))}
      </div>

      <PipelineExperimentGround
        initialExperiments={experiments}
        characters={dashboard.characters.map((character) => ({
          id: character.id,
          name: character.name,
          imageUrl: character.image_url ?? character.banner_url,
        }))}
      />
    </div>
  );
}
