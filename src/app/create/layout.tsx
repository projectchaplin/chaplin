import CreationGate from "@/components/CreationGate";

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <CreationGate nextPath="/create">{children}</CreationGate>;
}
