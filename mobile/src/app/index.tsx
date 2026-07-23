import { Redirect } from "expo-router";

import { LoadingView } from "@/components/state-view";
import { useAuth } from "@/hooks/use-auth";

export default function EntryRoute() {
  const { loading, session } = useAuth();
  if (loading) return <LoadingView label="Opening your studio…" />;
  return <Redirect href={session ? "/(tabs)/(studio)" : "/auth"} />;
}
