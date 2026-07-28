import CreationGate from "@/components/CreationGate";

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  return <CreationGate nextPath="/studio/write">{children}</CreationGate>;
}
