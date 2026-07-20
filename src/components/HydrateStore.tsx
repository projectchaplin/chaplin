"use client";

import { useEffect } from "react";
import { useChaplinStore } from "@/lib/store";

/** Invisible. Pulls any saved additions out of localStorage once, after
 * mount, so the server-rendered seed world never mismatches the client's
 * first paint. */
export default function HydrateStore() {
  const hydrateFromStorage = useChaplinStore((s) => s.hydrateFromStorage);
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);
  return null;
}
