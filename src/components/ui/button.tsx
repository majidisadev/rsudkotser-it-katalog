import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Button — grammar DESIGN.md/DSD. Aksen tunggal Action Blue; scale-press 0.96;
 * tanpa shadow. Varian minimal untuk Sprint 01 (read); varian lain menyusul.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[600] transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover rounded-full",
        secondary:
          "border border-primary text-primary bg-transparent rounded-full hover:bg-primary/5",
        ghost: "text-ink hover:bg-surface-2 rounded-inline",
      },
      size: {
        md: "h-11 px-5 text-[17px]",
        sm: "h-10 px-4 text-[14px]",
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
