"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { id as idLocale } from "react-day-picker/locale";
import { cn } from "@/lib/utils";

/**
 * Calendar — pembungkus react-day-picker (shadcn) yang di-theme dengan token
 * desain proyek (surface/ink/primary/hairline), bukan token default shadcn.
 * Dipakai mode `range` pada filter peminjaman. Locale id-ID.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={idLocale}
      className={cn("relative p-1", className)}
      classNames={{
        months: "flex flex-col",
        month: "flex flex-col gap-3",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-[14px] font-[600] capitalize text-ink",
        nav: "absolute inset-x-1 top-1 flex h-9 items-center justify-between",
        button_previous:
          "inline-flex h-8 w-8 items-center justify-center rounded-inline text-ink-muted hover:bg-surface-2 disabled:opacity-40",
        button_next:
          "inline-flex h-8 w-8 items-center justify-center rounded-inline text-ink-muted hover:bg-surface-2 disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "flex h-8 w-9 items-center justify-center text-[12px] font-[500] capitalize text-ink-muted",
        week: "mt-0.5 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-[13px] focus-within:relative focus-within:z-10",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-1",
        selected: "",
        range_start:
          "rounded-l-full bg-primary/12 [&>button]:bg-primary [&>button]:!text-primary-fg [&>button]:hover:bg-primary",
        range_end:
          "rounded-r-full bg-primary/12 [&>button]:bg-primary [&>button]:!text-primary-fg [&>button]:hover:bg-primary",
        range_middle: "bg-primary/12 [&>button]:rounded-none [&>button]:hover:bg-primary/20",
        today: "[&>button]:font-[700] [&>button]:text-primary",
        outside: "text-ink-disabled [&>button]:text-ink-disabled [&>button]:opacity-50",
        disabled: "[&>button]:cursor-not-allowed [&>button]:text-ink-disabled [&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft size={16} aria-hidden />
          ) : (
            <ChevronRight size={16} aria-hidden />
          ),
      }}
      {...props}
    />
  );
}
