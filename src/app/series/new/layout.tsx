import CreationGate from "@/components/CreationGate";

export default function NewSeriesLayout({ children }: { children: React.ReactNode }) {
  return <CreationGate nextPath="/series/new">{children}</CreationGate>;
}
