import WatchBrowse from "@/components/WatchBrowse";
import { listSeries } from "@/lib/server/series";
import type { SeriesSummary } from "@/lib/series-types";

export const dynamic = "force-dynamic";

export default async function SeriesPage() {
  let series: SeriesSummary[] = [];
  try {
    series = await listSeries();
  } catch {
    // The browse rows still render from the client store when the slate can't load.
    series = [];
  }
  return <WatchBrowse series={series} />;
}
