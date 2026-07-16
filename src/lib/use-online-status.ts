"use client";

import { useEffect, useState } from "react";

/**
 * Status koneksi jaringan (S4.4 — poles offline). Mengembalikan `true` saat
 * online. Default `true` di server/first-render (hindari flash offline); nilai
 * nyata dibaca setelah mount dari `navigator.onLine` + event online/offline.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
