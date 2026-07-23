import { useLocalSearchParams } from "expo-router";

import { SparkProductionScreen } from "@/screens/spark-production";

export default function SparkProductionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SparkProductionScreen draftId={id} />;
}
