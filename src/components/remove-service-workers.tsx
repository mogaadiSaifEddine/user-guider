"use client";

import { useEffect } from "react";

// This app has no service worker. A leftover one from another project served on
// the same origin (common on localhost:3000) can serve stale JS chunks, which shows
// up as hydration mismatches and "Server Action not found" errors. Remove it.
export function RemoveServiceWorkers() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (!regs.length) return;
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Reload once so the page comes from the server, not the old worker.
      window.location.reload();
    });
  }, []);
  return null;
}
