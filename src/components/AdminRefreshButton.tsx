"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AdminRefreshButton() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={refreshing}
      className="border border-line rounded-full px-4 py-2.5 text-xs text-grey hover:text-accent hover:border-accent disabled:opacity-50"
    >
      {refreshing ? "Refreshing..." : "Refresh status"}
    </button>
  );
}

