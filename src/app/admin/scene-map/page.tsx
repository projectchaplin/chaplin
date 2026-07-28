import { redirect } from "next/navigation";
import AdminRefreshButton from "@/components/AdminRefreshButton";
import AdminSceneWiringMap from "@/components/AdminSceneWiringMap";
import AdminSectionNav from "@/components/AdminSectionNav";
import { getServerAuthIdentity } from "@/lib/server/auth";
import { getPipelineConfig } from "@/lib/server/pipeline-config";
import { listCharacters } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminSceneMapPage() {
  const identity = await getServerAuthIdentity();
  if (identity?.role !== "admin") redirect("/super-admin?next=/admin/scene-map");
  const [characters, config] = await Promise.all([listCharacters(), getPipelineConfig()]);

  return (
    <div className="app-width min-w-0 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Super Admin · Production system</p>
          <h1 className="marquee-title text-3xl leading-tight sm:text-5xl">SCENE WIRING MAP</h1>
          <p className="mt-2 max-w-3xl text-sm text-grey">Choose any actor to inspect and copy the private master character prompt, every generated production prompt, its active provider route, and the boundaries that keep the finished scene coherent. This screen is restricted to Super Admin.</p>
        </div>
        <AdminRefreshButton />
      </div>

      <AdminSectionNav />
      <AdminSceneWiringMap characters={characters} config={config} />
    </div>
  );
}
