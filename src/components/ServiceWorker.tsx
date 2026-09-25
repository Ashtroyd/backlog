"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (production only — in dev it would serve stale
 * build files), then hands it the build files this page already loaded,
 * which it couldn't see because it wasn't running yet.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(`${location.origin}/_next/static/`));
        reg.active?.postMessage({ type: "cache-urls", urls });
      })
      .catch(() => {
        // No offline support this visit; everything else works as normal.
      });
  }, []);
  return null;
}
