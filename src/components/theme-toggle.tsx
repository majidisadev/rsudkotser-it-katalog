"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Toggle tema — aria-label + aria-pressed (DSD A11y). Tanpa flash saat load. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={
        mounted ? (isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap") : "Ganti tema"
      }
      aria-pressed={mounted ? isDark : undefined}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform active:scale-[0.96]",
        "hover:bg-surface-2",
        className,
      )}
    >
      {/* Hindari mismatch hydration: render ikon hanya setelah mounted. */}
      {mounted ? (
        isDark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />
      ) : (
        <span className="h-5 w-5" />
      )}
    </button>
  );
}
