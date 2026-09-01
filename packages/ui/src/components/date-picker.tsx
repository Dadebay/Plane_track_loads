"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export interface DatePickerLabels {
  clear: string;
  today: string;
  placeholder: string;
}

const DEFAULT_LABELS: DatePickerLabels = { clear: "Clear", today: "Today", placeholder: "dd.mm.yyyy" };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromIso(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday-first 6x7 day grid for the given month. */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * Custom-styled calendar dropdown — native `<input type="date">` renders an
 * OS-level popup that can't be restyled with CSS, so filters/forms that want
 * a themed calendar (dark mode, brand colors, mobile touch targets) need
 * this instead. Value/onChange use the same "YYYY-MM-DD" string the native
 * input does, so it's a drop-in replacement. Pass `name` to also render a
 * hidden input for uncontrolled `FormData`-based forms.
 */
export function DatePicker({
  value,
  onChange,
  name,
  required,
  locale = "en",
  labels,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  locale?: string;
  labels?: Partial<DatePickerLabels>;
  className?: string;
  disabled?: boolean;
}) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => (selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selected ?? today).getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openAt(date: Date) {
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const grid = buildMonthGrid(viewYear, viewMonth);
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const displayFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div ref={containerRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(selected ?? today))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-bg px-3 text-left text-sm text-fg outline-none transition-colors sm:h-9",
          "hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <span className={cn(!selected && "text-fg-subtle")}>{selected ? displayFmt.format(selected) : l.placeholder}</span>
        <Calendar className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-border bg-bg p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold capitalize text-fg">{monthFmt.format(new Date(viewYear, viewMonth, 1))}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-muted hover:text-fg"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-muted hover:text-fg"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {grid.slice(0, 7).map((d) => (
              <span key={d.getDay()} className="text-xs font-medium text-fg-subtle">
                {weekdayFmt.format(d)}
              </span>
            ))}
            {grid.map((d) => {
              const inMonth = d.getMonth() === viewMonth;
              const isSelected = selected ? sameDay(d, selected) : false;
              const isToday = sameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(toIso(d));
                    setOpen(false);
                  }}
                  className={cn(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                    !inMonth && "text-fg-subtle/50",
                    inMonth && !isSelected && "text-fg hover:bg-bg-muted",
                    isSelected && "bg-brand-500 font-semibold text-fg-on-brand",
                    !isSelected && isToday && "ring-1 ring-inset ring-brand-500",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-medium text-fg-subtle hover:text-fg"
            >
              {l.clear}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(toIso(today));
                openAt(today);
                setOpen(false);
              }}
              className="text-xs font-medium text-brand-500 hover:underline"
            >
              {l.today}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
