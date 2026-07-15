import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Layout panel admin terautentikasi (route group `(panel)` — tak memengaruhi
 * URL). Login (`/admin/login`) berada di luar grup ini → tanpa sidebar. Sesi
 * ditegakkan middleware.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
