import CreationGate from "@/components/CreationGate";

export default function NewVideoLayout({ children }: { children: React.ReactNode }) {
  return <CreationGate nextPath="/videos/new">{children}</CreationGate>;
}
