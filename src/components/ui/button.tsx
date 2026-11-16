import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Button — grammar DESIGN.md/DSD. Aksen tunggal Action Blue; tekan = utilitas
 * `press` (0.96, 150ms); tanpa shadow. Hierarki: `primary` hanya untuk SATU
 * langkah berikutnya per permukaan; aksi pendamping memakai `secondary` /
 * `ghost`. Tinggi `sm` naik ke 44px pada layar sentuh (target jari).
 */
const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap font-[600] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover rounded-full",
        secondary:
          "border border-link text-link bg-transparent rounded-full hover:bg-primary/5",
        ghost: "text-ink hover:bg-surface-2 rounded-full",
      },
      size: {
        md: "h-11 px-5 text-[17px]",
        sm: "h-10 px-4 text-[14px] pointer-coarse:h-11",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
