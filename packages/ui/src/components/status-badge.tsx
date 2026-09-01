import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export type FlightStatus =
  | "reserved"
  | "planned"
  | "loading"
  | "finalized"
  | "departed"
  | "arrived"
  | "cancelled";

/** Generic semantic tone for statuses that don't have their own dedicated
 * color set (e.g. ULD status/condition) — reuses the theme's generic
 * success/warning/danger tokens instead of adding a new token per status. */
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const STATUS_CLASS: Record<FlightStatus, string> = {
  reserved: "bg-status-reserved-bg text-status-reserved",
  planned: "bg-status-planned-bg text-status-planned",
  loading: "bg-status-loading-bg text-status-loading",
  finalized: "bg-status-finalized-bg text-status-finalized",
  departed: "bg-status-departed-bg text-status-departed",
  arrived: "bg-status-arrived-bg text-status-arrived",
  cancelled: "bg-status-cancelled-bg text-status-cancelled",
};

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-bg-muted text-fg-muted",
  info: "bg-status-planned-bg text-status-planned",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

type StatusBadgeProps =
  | { status: FlightStatus; tone?: never; children: ReactNode; className?: string }
  | { status?: never; tone: BadgeTone; children: ReactNode; className?: string };

export function StatusBadge({ status, tone, children, className }: StatusBadgeProps) {
  const toneClass = status ? STATUS_CLASS[status] : TONE_CLASS[tone];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", toneClass, className)}
    >
      {children}
    </span>
  );
}
