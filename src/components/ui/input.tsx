import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Input pill (grammar DESIGN.md `search-input`) — hairline, tinggi 44. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-full border border-hairline bg-surface px-5 text-[17px] text-ink",
        "placeholder:text-ink-muted focus-visible:border-primary",
        "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    />
  );
}
