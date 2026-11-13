"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `false` saat SSR & render hydration, `true` setelahnya — untuk UI yang
 * bergantung pada nilai khusus client (mis. tema) tanpa mismatch hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
