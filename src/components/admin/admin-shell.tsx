"use client";

import * as Dialog from "@radix-ui/react-dialog";
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
 * mobile (Radix Dialog: focus-trap, Escape, scroll-lock). Nav spesifik &
 * langsung (Apple §16 wayfinding). Alat harian → tenang: item aktif ditandai
 * isian netral + ikon beraksen (bukan blok biru penuh); logout = baris utility.
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
              "flex h-10 items-center gap-3 rounded-inline px-3 text-[15px] font-[600] transition-colors duration-[var(--dur-fast)] pointer-coarse:h-11",
              active ? "bg-surface-2 text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon size={20} aria-hidden className={active ? "text-link" : undefined} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      className="press mt-auto flex h-10 items-center gap-3 rounded-inline px-3 text-[15px] font-[600] text-ink-muted hover:bg-surface-2 hover:text-ink pointer-coarse:h-11"
    >
      <LogOut size={20} aria-hidden /> Keluar
    </button>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-hairline bg-surface p-4 lg:flex">
        <Link
          href="/"
          title="Ke halaman utama"
          className="mb-6 block px-3 text-[21px] font-[600] tracking-tight transition-colors duration-[var(--dur-fast)] hover:text-link"
        >
          Katalog IT
        </Link>
        {navLinks}
        {logoutButton}
      </aside>

      {/* Drawer mobile */}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-motion fixed inset-0 z-30 bg-black/40 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="nav-drawer fixed inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-transparent bg-surface p-4 shadow-[var(--shadow-float)] lg:hidden"
          >
            <div className="mb-6 flex items-center justify-between">
              <Dialog.Title asChild>
                <Link
                  href="/"
                  title="Ke halaman utama"
                  onClick={() => setDrawer(false)}
                  className="px-3 text-[21px] font-[600] tracking-tight transition-colors duration-[var(--dur-fast)] hover:text-link"
                >
                  Katalog IT
                </Link>
              </Dialog.Title>
              <Dialog.Close
                aria-label="Tutup menu"
                className="press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X size={22} aria-hidden />
              </Dialog.Close>
            </div>
            {navLinks}
            {logoutButton}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Konten */}
      <div className="lg:pl-60">
        <OfflineBanner />
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-hairline bg-surface/80 px-4 py-3 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Buka menu"
            aria-expanded={drawer}
            className="press -ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden"
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
