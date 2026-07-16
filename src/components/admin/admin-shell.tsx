"use client";

import { LayoutDashboard, LogOut, Menu, Package, ScrollText, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import { logout } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminQueryProvider } from "./query-provider";
import { NotificationBell } from "./notification-bell";

/**
 * Kerangka admin (DSD S4 / Patterns) — sidebar kiri desktop (`lg+`), drawer di
 * mobile. Nav spesifik & langsung (Apple §16 wayfinding); logout = tombol utility.
 * Membungkus panel dengan TanStack Query + Toaster.
 */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/barang", label: "Barang", icon: Package },
  { href: "/admin/peminjaman", label: "Peminjaman", icon: ScrollText },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminQueryProvider>
      <AdminShellInner>{children}</AdminShellInner>
      <Toaster position="top-center" richColors closeButton />
    </AdminQueryProvider>
  );
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);

  const onLogout = async () => {
    try {
      await logout();
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Gagal keluar. Coba lagi.");
    }
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const navLinks = (
    <nav className="flex flex-col gap-1" aria-label="Navigasi admin">
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = isActive(n.href, n.exact);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setDrawer(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-inline px-3 py-2.5 text-[15px] font-[600] transition-colors",
              active ? "bg-primary text-primary-fg" : "text-ink hover:bg-surface-2",
            )}
          >
            <Icon size={20} aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-hairline bg-surface p-4 lg:flex">
        <Link
          href="/"
          title="Ke halaman utama"
          className="mb-6 block px-2 text-[21px] font-[700] tracking-[-0.374px] transition-colors hover:text-primary"
        >
          Katalog IT
        </Link>
        {navLinks}
        <button
          type="button"
          onClick={onLogout}
          className="mt-auto flex items-center gap-2 rounded-inline bg-ink px-3 py-2.5 text-[14px] font-[600] text-canvas transition-transform active:scale-[0.98]"
        >
          <LogOut size={18} aria-hidden /> Keluar
        </button>
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-hairline bg-surface p-4 shadow-[var(--shadow-float)]">
            <div className="mb-6 flex items-center justify-between px-2">
              <Link
                href="/"
                title="Ke halaman utama"
                onClick={() => setDrawer(false)}
                className="text-[21px] font-[700] transition-colors hover:text-primary"
              >
                Katalog IT
              </Link>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Tutup menu">
                <X size={22} aria-hidden />
              </button>
            </div>
            {navLinks}
            <button
              type="button"
              onClick={onLogout}
              className="mt-auto flex items-center gap-2 rounded-inline bg-ink px-3 py-2.5 text-[14px] font-[600] text-canvas"
            >
              <LogOut size={18} aria-hidden /> Keluar
            </button>
          </aside>
        </div>
      )}

      {/* Konten */}
      <div className="lg:pl-60">
        <OfflineBanner />
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-hairline bg-surface/80 px-4 py-3 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Buka menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden"
          >
            <Menu size={22} aria-hidden />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
