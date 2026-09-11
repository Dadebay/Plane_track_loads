"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateTimePartsInZone } from "@/lib/format-date";

/**
 * Time axis for the selected flight leg.
 *
 * Shows where the leg's own timestamps sit against the clock, with a marker
 * for now. The strip is draggable left and right because a leg is usually
 * nowhere near the current time — panning is how you get from "now" to the
 * departure without changing the filters.
 *
 * Only times the schedule actually holds are plotted. A leg with no actual
 * departure gets no ATD marker rather than a guessed one.
 */

const MINUTE = 60_000;
/** Horizontal scale. 4 px per minute puts a 15-minute tick every 60 px. */
const PX_PER_MINUTE = 4;
const TICK_MINUTES = 15;
/** How far one arrow-key press pans, in minutes. */
const KEY_STEP_MINUTES = 15;

export interface TimelineMarker {
  key: string;
  label: string;
  at: Date;
  tone: "scheduled" | "estimated" | "actual" | "now";
}

export function FlightTimeline({
  title,
  markers,
  timezone,
  onClose,
  openLoadPlanLabel,
  onOpenLoadPlan,
}: {
  title: string;
  markers: TimelineMarker[];
  /** Zone every label on this strip is read in. */
  timezone: string;
  onClose: () => void;
  openLoadPlanLabel: string;
  onOpenLoadPlan: () => void;
}) {
  const t = useTranslations("flights.timeline");
  const trackRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  // `now` is read once on mount, not during render: the server has a
  // different clock reading than the browser and React would flag the
  // mismatch. Null until then, so the first paint matches the server's.
  const [now, setNow] = useState<number | null>(null);
  const [centre, setCentre] = useState<number | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startCentre: number } | null>(null);

  useEffect(() => {
    const current = Date.now();
    setNow(current);
    // Open on the leg's first timestamp when it has one — that is what the
    // controller selected the row to look at — otherwise on the clock.
    const first = markers.length > 0 ? Math.min(...markers.map((m) => m.at.getTime())) : current;
    setCentre(first);
    // Re-centring on every marker change would fight the user's dragging;
    // the strip is remounted per selection instead (see `key` at the call
    // site), so this only ever runs for a newly selected leg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Attaches the size observer as soon as the track exists.
   *
   * A plain `useEffect` on mount is too early: the first render shows a
   * placeholder while `now` and `centre` are still unset, so the ref is
   * null and the observer never gets created — the measured width stays 0
   * and every marker is culled as off-screen.
   */
  const observerRef = useRef<ResizeObserver | null>(null);
  const attachTrack = useCallback((node: HTMLDivElement | null) => {
    trackRef.current = node;
    observerRef.current?.disconnect();
    if (!node) {
      observerRef.current = null;
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(node);
    observerRef.current = observer;
    setWidth(node.getBoundingClientRect().width);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (centre === null) return;
      drag.current = { pointerId: event.pointerId, startX: event.clientX, startCentre: centre };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [centre],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    // Dragging right moves the strip's content right, i.e. shows earlier time.
    setCentre(state.startCentre - (dx / PX_PER_MINUTE) * MINUTE);
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setCentre((c) => (c === null ? c : c + direction * KEY_STEP_MINUTES * MINUTE));
  }, []);

  if (centre === null || now === null) {
    // Reserve the height so selecting a row does not shift the table.
    return <div className="h-24 rounded-xl border border-border bg-bg-subtle" aria-hidden="true" />;
  }

  const halfSpanMs = width > 0 ? (width / 2 / PX_PER_MINUTE) * MINUTE : 45 * MINUTE;
  const from = centre - halfSpanMs;
  const to = centre + halfSpanMs;
  const xOf = (ms: number) => ((ms - from) / MINUTE) * PX_PER_MINUTE;

  // Tick marks on the quarter hour, from the first one at or after `from`.
  const tickStep = TICK_MINUTES * MINUTE;
  const firstTick = Math.ceil(from / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let ms = firstTick; ms <= to; ms += tickStep) ticks.push(ms);

  const allMarkers: TimelineMarker[] = [
    ...markers,
    { key: "now", label: t("now"), at: new Date(now), tone: "now" },
  ];

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 rounded-xl border border-border bg-bg-subtle p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenLoadPlan}
            className="h-8 rounded-md bg-brand-500 px-3 text-xs font-semibold text-fg-on-brand hover:bg-brand-600"
          >
            {openLoadPlanLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            {t("close")}
          </button>
        </span>
      </div>

      {/* The times in words. A strip you have to drag is no use to a screen
          reader, so the same information is listed here. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-fg-muted">
        {markers.map((marker) => (
          <li key={marker.key}>
            <span className="font-semibold uppercase tracking-wide">{marker.label}</span>{" "}
            <span className="font-mono tabular-nums">
              {formatDateTimePartsInZone(marker.at, timezone).time}
            </span>
          </li>
        ))}
      </ul>

      <div
        ref={attachTrack}
        role="group"
        tabIndex={0}
        aria-label={t("dragHint")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative h-20 cursor-grab touch-none select-none overflow-hidden rounded-lg border border-border bg-bg active:cursor-grabbing"
      >
        {ticks.map((ms) => {
          const parts = formatDateTimePartsInZone(new Date(ms), timezone);
          // The hour and half hour read as the anchors; quarter hours are
          // there for scale, not for reading.
          const isMajor = new Date(ms).getUTCMinutes() % 30 === 0;
          return (
            <div key={ms} className="pointer-events-none absolute inset-y-0" style={{ left: xOf(ms) }}>
              <div className={`h-8 w-px ${isMajor ? "bg-border-strong" : "bg-border"}`} />
              <span
                className={`absolute top-9 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums ${
                  isMajor ? "font-semibold text-fg-muted" : "text-fg-subtle"
                }`}
              >
                {parts.time}
              </span>
            </div>
          );
        })}

        {allMarkers.map((marker) => {
          const x = xOf(marker.at.getTime());
          if (x < -40 || x > width + 40) return null;
          return (
            <div
              key={marker.key}
              className="pointer-events-none absolute top-1 flex -translate-x-1/2 flex-col items-center"
              style={{ left: x }}
            >
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-fg-on-brand ${
                  marker.tone === "now"
                    ? "bg-danger"
                    : marker.tone === "actual"
                      ? "bg-success"
                      : marker.tone === "estimated"
                        ? "bg-info"
                        : "bg-brand-500"
                }`}
              >
                {marker.label}
              </span>
              <span
                className={`w-px flex-1 ${
                  marker.tone === "now"
                    ? "bg-danger"
                    : marker.tone === "actual"
                      ? "bg-success"
                      : marker.tone === "estimated"
                        ? "bg-info"
                        : "bg-brand-500"
                }`}
                style={{ height: 26 }}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-fg-subtle">{t("dragHint")}</p>
    </section>
  );
}
