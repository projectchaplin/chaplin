import { redirect } from "next/navigation";
import { getServerAuthIdentity } from "@/lib/server/auth";

export default async function CreationGate({
  children,
  nextPath,
}: {
  children: React.ReactNode;
  nextPath: string;
}) {
  const identity = await getServerAuthIdentity();
  if (!identity) redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  return children;
}
