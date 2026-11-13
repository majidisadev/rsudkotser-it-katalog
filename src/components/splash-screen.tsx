"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Batas atas tampil splash — jaringan lambat tak boleh menahan halaman. */
const MAX_VISIBLE_MS = 4000;
/** Selaras durasi transisi fade-out di bawah (lalu elemen dilepas dari DOM). */
const FADE_MS = 300;

/**
 * Splash + loading spinner saat website pertama kali dibuka (muat dokumen penuh).
 * Dirender di HTML server → tampil sejak paint pertama, lalu memudar setelah
 * halaman siap (`window.load`, maks. 4 dtk). Ada di root layout yang bertahan
 * antar navigasi client, jadi hanya muncul sekali per muat penuh — bukan tiap
 * pindah halaman (navigasi memakai top loader). Fallback CSS `.app-splash`
 * menyembunyikannya sendiri bila JS gagal dimuat.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "gone">("visible");

  useEffect(() => {
    let removeTimer: number | undefined;
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      setPhase("leaving");
      removeTimer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    };

    // rAF: beri satu frame agar splash sempat ter-paint sebelum memudar.
    const frame = window.requestAnimationFrame(() => {
      if (document.readyState === "complete") hide();
    });
    window.addEventListener("load", hide, { once: true });
    const capTimer = window.setTimeout(hide, MAX_VISIBLE_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("load", hide);
      window.clearTimeout(capTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-leaving={phase === "leaving" ? "" : undefined}
      className="app-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-canvas transition-opacity duration-300 ease-[var(--ease-out)] data-[leaving]:pointer-events-none data-[leaving]:opacity-0"
    >
      <Image src="/logo.png" alt="" width={56} height={59} priority className="h-14 w-auto" />
      <span
        aria-hidden
        className="app-splash-spinner h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
      />
      <span className="text-[15px] font-[500] text-ink-muted">Memuat…</span>
    </div>
  );
}
