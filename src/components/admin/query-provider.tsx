"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Penyedia TanStack Query untuk panel admin (SDD Tech Stack). Baca boleh retry;
 * mutasi tidak (hindari duplikasi — SDD Error Handling). `staleTime` pendek agar
 * data tetap segar tanpa polling berlebih.
 */
export function AdminQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
