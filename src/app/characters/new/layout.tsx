import CreationGate from "@/components/CreationGate";

export default function NewCharacterLayout({ children }: { children: React.ReactNode }) {
  return <CreationGate nextPath="/characters/new">{children}</CreationGate>;
}
