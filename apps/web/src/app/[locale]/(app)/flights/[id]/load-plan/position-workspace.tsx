"use client";

import { useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { buildPositionFootprints } from "@tua/wnb-core";
import { formatWeight } from "@/lib/format-number";
import type { LoadPlanAhmData } from "@/lib/load-plan-calc";
import { buildWorkspace, nextCellIndex, type CellState, type WorkspaceRow } from "@/lib/position-workspace";
import { useLoadDraftStore } from "./load-draft-store";
import { AircraftSilhouette, CARGO_BAY } from "./aircraft-silhouette";

/**
 * The aircraft loading workspace — AHM 560 Appendix I s.74's configuration
 * rows, one row per printed row, with the same position codes.
 *
 * Every state is carried three ways: a colour, a symbol, and the cell's own
 * accessible name. A ramp tablet in daylight, a colour-blind controller and
 * a screen reader all get the same information (the brief's "distinct and
 * accessible without relying on color alone").
 *
 * Wide rows scroll inside their own container, never the page body, so a
 * 375 px phone has no horizontal body scroll.
 */

/** Symbol shown in the corner of every non-empty cell. Deliberately not an
 * icon font: it has to survive a screenshot on a cheap tablet. */
const STATE_SYMBOL: Record<CellState, string> = {
  EMPTY: "",
  LOADED: "▪", // ▪
  OVERLOADED: "⚠", // ⚠
  BLOCKED: "✕", // ✕
  READ_ONLY: "▪",
};

const STATE_CLASS: Record<CellState, string> = {
  EMPTY: "border-border bg-bg text-fg-subtle hover:bg-bg-muted",
  LOADED: "border-info bg-info-bg text-fg hover:brightness-95",
  OVERLOADED: "border-danger bg-danger-bg text-danger hover:brightness-95",
  // Dashed border is the non-colour cue that this cell cannot be used.
  BLOCKED: "border-dashed border-fg-subtle bg-bg-muted text-fg-subtle",
  READ_ONLY: "border-border bg-bg-subtle text-fg-muted",
};

const DECK_STATE_CLASS: Record<CellState, string> = {
  EMPTY: "border-border-strong bg-bg/90 text-fg hover:border-brand-500 hover:bg-brand-50",
  LOADED: "border-info bg-info-bg/95 text-fg hover:brightness-95",
  OVERLOADED: "border-danger bg-danger-bg/95 text-danger hover:brightness-95",
  BLOCKED: "border-dashed border-fg-subtle bg-bg-muted/95 text-fg-subtle",
  READ_ONLY: "border-border bg-bg-subtle/95 text-fg-muted",
};

export function PositionWorkspace({
  ahmData,
  overloaded,
  readOnly,
  onSelect,
}: {
  ahmData: LoadPlanAhmData;
  overloaded: Set<string>;
  readOnly: boolean;
  onSelect: (code: string) => void;
}) {
  const t = useTranslations("loadPlan.workspace");
  const tPositions = useTranslations("loadPlan.positions");
  const items = useLoadDraftStore((s) => s.items);

  // Footprint geometry depends only on the AHM data, so it is derived once
  // and not on every keystroke.
  const footprints = useMemo(
    () =>
      ahmData.positionConfigurations
        ? buildPositionFootprints(
            ahmData.positions,
            ahmData.positionConfigurations,
            ahmData.indexFormula,
            ahmData.halfContainerPositions,
          )
        : [],
    [ahmData],
  );

  const workspace = useMemo(
    () => buildWorkspace(ahmData, items, footprints, overloaded, readOnly),
    [ahmData, items, footprints, overloaded, readOnly],
  );

  // The 88" single row is the loading-zone row: one cell per zone A..U, the
  // set every index and limit table in the AHM is keyed by.
  // The 88" single row is the loading-zone row: one cell per zone A..U, the
  // set every index and limit table in the AHM is keyed by. It is drawn
  // inside the aircraft between the decks, so it is not repeated here.
  const zoneRow = workspace.main.find((row) => row.id === "SINGLE_ROW_88x125") ?? null;
  const mainRows = workspace.main.filter((row) => row !== zoneRow);

  if (workspace.main.length === 0 && workspace.lower.length === 0) {
    // This AHM revision carries no position plate. Say so rather than
    // rendering an empty frame that looks like a loading state.
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-fg-subtle">
        {t("noConfigurations")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-border bg-bg-subtle shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-2.5 text-slate-50">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
            <span className="h-2 w-2 rounded-full bg-brand-400" aria-hidden="true" />
            {tPositions("mainDeck")}
          </h3>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {mainRows.map((row) => (
              <Row key={row.id} row={row} onSelect={onSelect} />
            ))}
          </div>
        </div>
      </section>

      {/* The aircraft sits between the two decks, the way the approved AHM
          560 Appendix I plate lays the sheet out: the main-deck rows above
          are alternative ways of using this floor, the lower-deck rows below
          are what is underneath it. The loading zones A..U are drawn inside
          the fuselage because they are the aircraft, not a legend beside it. */}
      {zoneRow ? (
        <DeckPlan row={zoneRow} onSelect={onSelect} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-bg">
          <div className="min-w-[720px] px-1">
            <AircraftSilhouette className="block h-auto w-full" />
          </div>
        </div>
      )}

      {workspace.lower.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-bg-subtle shadow-sm">
          <div className="bg-slate-900 px-4 py-2.5 text-slate-50">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
              <span className="h-2 w-2 rounded-full bg-brand-400" aria-hidden="true" />
              {tPositions("lowerDeck")}
            </h3>
          </div>
          <div className="flex flex-col divide-y divide-border px-3 py-2 sm:px-4">
            {workspace.lower.map((row) => (
              <Row key={row.id} row={row} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ) : null}

      <Legend />
    </div>
  );
}

/**
 * The loading-zone row laid over the aircraft outline.
 *
 * Same buttons, same states, same keyboard behaviour as any other row — only
 * the frame around them differs, so nothing about accessibility is traded
 * away for the picture.
 */
function DeckPlan({ row, onSelect }: { row: WorkspaceRow; onSelect: (code: string) => void }) {
  return (
    // The drawing scrolls inside its own box rather than shrinking past the
    // point where a position code is readable. The page body never scrolls
    // sideways because of it.
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-bg">
      <div className="relative min-w-[720px] px-1">
        {/* No height class on purpose. The SVG keeps its aspect ratio, so
            giving it a height that does not match would letterbox the
            drawing inside its own box — and CARGO_BAY's percentages are
            measured against that box, not against the drawing. The cells
            would then sit outside the fuselage. With width alone, box and
            drawing are the same rectangle at every size. */}
        <AircraftSilhouette className="block h-auto w-full" />
        <div
          className="absolute flex items-center gap-[2px] sm:gap-1"
          style={{
            left: CARGO_BAY.left,
            right: CARGO_BAY.right,
            top: "50%",
            transform: "translateY(-50%)",
            height: CARGO_BAY.height,
          }}
        >
          <RowCells row={row} onSelect={onSelect} variant="deck" />
        </div>
      </div>
    </div>
  );
}

function Row({ row, onSelect }: { row: WorkspaceRow; onSelect: (code: string) => void }) {
  const isSideBySide = row.cells.length > 0 && row.cells.every((cell) => /[LR]$/.test(cell.code));
  const tracks = isSideBySide
    ? [
        { ...row, id: `${row.id}-R`, cells: row.cells.filter((cell) => cell.code.endsWith("R")) },
        { ...row, id: `${row.id}-L`, cells: row.cells.filter((cell) => cell.code.endsWith("L")) },
      ]
    : [row];

  return (
    <section aria-label={row.label} className="grid gap-2 py-3 md:grid-cols-[9.5rem_minmax(0,1fr)] md:items-center">
      <h4 className="font-mono text-[10px] font-bold uppercase leading-tight tracking-wide text-fg-subtle">
        {row.label}
      </h4>
      {/* Wide rows scroll here, not on <body> — 375 px stays clean. */}
      <div className="min-w-0 overflow-x-auto pb-1">
        <div className="flex min-w-max flex-col gap-1.5">
          {tracks.map((track) => (
            <div key={track.id} className="flex gap-1">
              <RowCells row={track} onSelect={onSelect} variant="row" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The cells of one configuration row.
 *
 * `variant` only changes how much room a cell takes: `row` keeps the 44 px
 * touch target the ramp needs, `deck` shrinks to fit inside the fuselage
 * outline while staying at least 44 px tall. State, labelling and keyboard
 * behaviour are identical either way.
 */
function RowCells({
  row,
  onSelect,
  variant,
}: {
  row: WorkspaceRow;
  onSelect: (code: string) => void;
  variant: "row" | "deck";
}) {
  const t = useTranslations("loadPlan.workspace");
  const containerRef = useRef<HTMLDivElement>(null);

  // Roving focus: the row is one tab stop, arrows walk the cells inside it.
  // Without this a controller would tab through 119 buttons to reach the
  // tail of the aircraft.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, index: number) => {
      const target = nextCellIndex(index, row.cells.length, event.key);
      if (target === null) return;
      event.preventDefault();
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-cell]");
      buttons?.[target]?.focus();
    },
    [row.cells.length],
  );

  const sizing =
    variant === "deck"
      ? // Height comes from the cargo bay, never from a minimum of its own:
        // a min-height taller than the bay is exactly what pushed these
        // cells outside the fuselage. The 720px floor on the deck plan keeps
        // the resulting cell comfortably clickable.
        "h-full flex-1 min-w-0 px-0.5 shadow-md"
      : "min-h-[48px] min-w-[58px]";

  return (
    <div ref={containerRef} className="contents" role="group" aria-label={row.label}>
      {row.cells.map((cell, index) => {
        const disabled = cell.state === "BLOCKED" || cell.state === "READ_ONLY";
        const label = [
          cell.code,
          t(`state.${cell.state}` as never),
          cell.weight ? formatWeight(cell.weight) : null,
          cell.uldCode,
          cell.blockedBy.length > 0 ? t("blockedByList", { positions: cell.blockedBy.join(", ") }) : null,
        ]
          .filter(Boolean)
          .join(", ");

        return (
          <button
            key={cell.key}
            data-cell
            type="button"
            // One tab stop per row; arrows move within it.
            tabIndex={index === 0 ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => !disabled && onSelect(cell.code)}
            aria-disabled={disabled}
            aria-label={label}
            title={label}
            className={`flex flex-col items-center overflow-hidden rounded-md border transition ${sizing} ${
              variant === "deck" ? DECK_STATE_CLASS[cell.state] : STATE_CLASS[cell.state]
            } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`flex items-center justify-center gap-0.5 font-mono font-bold leading-none ${
                variant === "deck"
                  ? "h-full text-xs sm:text-sm"
                  : "h-5 w-full bg-slate-900 px-1 text-[10px] text-slate-50"
              }`}
            >
              {cell.code}
              <span aria-hidden="true" className="text-[10px] leading-none">
                {STATE_SYMBOL[cell.state]}
              </span>
            </span>
            {variant === "row" ? (
              <span className="flex min-h-7 max-w-full items-center truncate px-1.5 font-mono text-[10px] font-medium leading-none tabular-nums">
                {cell.weight ? formatWeight(cell.weight) : "\u00b7"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  const t = useTranslations("loadPlan.workspace");
  const states: CellState[] = ["EMPTY", "LOADED", "OVERLOADED", "BLOCKED"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
      {states.map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-flex h-4 w-6 items-center justify-center rounded border text-[9px] ${STATE_CLASS[state]}`}
          >
            {STATE_SYMBOL[state]}
          </span>
          {t(`state.${state}` as never)}
        </li>
      ))}
    </ul>
  );
}
