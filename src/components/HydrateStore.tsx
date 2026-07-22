"use client";

import { useEffect } from "react";
import { useChaplinStore } from "@/lib/store";

/** Invisible. Hydrates local state, then keeps the shared Supabase catalogue
 * current across devices, tabs, and client-side route changes. */
export default function HydrateStore() {
  const hydrateFromStorage = useChaplinStore((s) => s.hydrateFromStorage);
  const mergePersistedCharacters = useChaplinStore((s) => s.mergePersistedCharacters);
  useEffect(() => {
    hydrateFromStorage();

    let controller: AbortController | null = null;
    let stopped = false;

    function syncCatalogue() {
      if (stopped) return;
      controller?.abort();
      controller = new AbortController();
      void fetch("/api/characters", {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not load the shared AI actor catalogue.");
          return response.json() as Promise<{ characters?: unknown }>;
        })
        .then((payload) => {
          if (Array.isArray(payload.characters)) {
            mergePersistedCharacters(payload.characters);
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("Shared AI actor catalogue sync failed", error);
        });
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") syncCatalogue();
    }

    syncCatalogue();
    const interval = window.setInterval(syncWhenVisible, 15_000);
    window.addEventListener("focus", syncCatalogue);
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("chaplin:catalogue-updated", syncCatalogue);
    window.addEventListener("chaplin:media-updated", syncCatalogue);

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", syncCatalogue);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("chaplin:catalogue-updated", syncCatalogue);
      window.removeEventListener("chaplin:media-updated", syncCatalogue);
    };
  }, [hydrateFromStorage, mergePersistedCharacters]);
  return null;
}
