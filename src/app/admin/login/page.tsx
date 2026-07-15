"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, login } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Login admin (FR1/FR2). Password tunggal → sesi iron-session. Di luar route
 * group `(panel)` → tanpa sidebar. Sukses → redirect ke `?next` atau `/admin`.
 */
export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-[var(--shadow-float)]"
        >
          <h1 className="text-[28px] font-[700] tracking-[-0.374px]">Masuk Admin</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Katalog & Peminjaman IT RSUD Kotser</p>

          <label htmlFor="password" className="mt-6 block text-[14px] font-[600]">
            Kata sandi
          </label>
          <Input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
          {error && (
            <p id="login-error" role="alert" className="mt-2 text-[14px] text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading || password.length === 0} className="mt-5 w-full">
            {loading ? "Memeriksa…" : "Masuk"}
          </Button>

          <Link
            href="/"
            className="mt-4 block text-center text-[14px] font-[600] text-primary hover:underline"
          >
            ← Ke halaman utama
          </Link>
        </form>
      </div>
    </div>
  );
}
