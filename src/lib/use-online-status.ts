"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Status koneksi jaringan (S4.4 — poles offline). Mengembalikan `true` saat
 * online. Snapshot server/hydration `true` (hindari flash offline); nilai nyata
 * dari `navigator.onLine`, diperbarui lewat event online/offline.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
