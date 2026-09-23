"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Decimal } from "decimal.js";
import { useTranslations } from "next-intl";
import { buildPositionFootprints, positionIndex } from "@tua/wnb-core";
import { formatIndex, formatIndexPerKg, formatWeight } from "@/lib/format-number";
import { shortUldCode } from "@/lib/uld-code";
import type { LoadPlanAhmData } from "@/lib/load-plan-calc";
import {
  buildWorkspace,
  detailPanelPosition,
  nextCellIndex,
  type CellState,
  type WorkspaceCell,
  type WorkspaceRow,
} from "@/lib/position-workspace";
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

export interface Highlight {
  /** Key of the cell the controller tried to use. */
  blockedKey: string;
  /** Keys of the loaded cells standing in its way. */
  blockerKeys: string[];
}

/**
 * Brings the cells an explanation is talking about into view.
 *
 * Each configuration row scrolls on its own axis and the plate is taller
 * than the viewport, so the two cells the dialog names are often off
 * screen — ringing them then proves nothing. `nearest` keeps the page
 * still where it already shows the cell; `center` moves the row's own
 * horizontal scroller.
 */
function useScrollHighlightIntoView(highlight: Highlight | null) {
  useEffect(() => {
    if (!highlight) return;
    for (const key of [highlight.blockedKey, ...highlight.blockerKeys]) {
      const cell = document.querySelector(`[data-cell-key="${CSS.escape(key)}"]`);
      cell?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [highlight]);
}

export function PositionWorkspace({
  ahmData,
  overloaded,
  readOnly,
  onSelect,
  onBlocked,
  highlight,
}: {
  ahmData: LoadPlanAhmData;
  overloaded: Set<string>;
  readOnly: boolean;
  onSelect: (code: string, uldType: string) => void;
  onBlocked: (cell: WorkspaceCell) => void;
  /** Cells to call out while the blocked-cell explanation is open: the one
   * that cannot be used, and the loaded one holding its floor. */
  highlight: Highlight | null;
}) {
  const t = useTranslations("loadPlan.workspace");
  const tPositions = useTranslations("loadPlan.positions");
  useScrollHighlightIntoView(highlight);

  // Everything the plate publishes about a position, keyed the same way the
  // cells are. Derived once: the AHM data does not change while a plan is
  // open.
  const details = useMemo(() => {
    const configuration = new Map(
      (ahmData.positionConfigurations ?? []).map((row) => [row.id, row] as const),
    );
    return new Map(
      ahmData.positions.map((position) => {
        const row = configuration.get(position.uldType);
        return [
          `${position.uldType}/${position.code}`,
          {
            indexPerKg: position.indexPerKg,
            longitudinalInches: row?.longitudinalInches ?? null,
            lateralInches: row?.lateralInches ?? null,
          },
        ] as const;
      }),
    );
  }, [ahmData]);
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
              <Row key={row.id} row={row} onSelect={onSelect} onBlocked={onBlocked} highlight={highlight} details={details} readOnly={readOnly} />
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
        <DeckPlan row={zoneRow} onSelect={onSelect} onBlocked={onBlocked} highlight={highlight} details={details} readOnly={readOnly} />
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
              <Row key={row.id} row={row} onSelect={onSelect} onBlocked={onBlocked} highlight={highlight} details={details} readOnly={readOnly} />
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
function DeckPlan({
  row,
  onSelect,
  onBlocked,
  highlight,
  details,
  readOnly,
}: {
  row: WorkspaceRow;
  onSelect: (code: string, uldType: string) => void;
  onBlocked: (cell: WorkspaceCell) => void;
  highlight: Highlight | null;
  details: Map<string, CellDetail>;
  readOnly: boolean;
}) {
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
          <RowCells row={row} onSelect={onSelect} onBlocked={onBlocked} highlight={highlight} details={details} readOnly={readOnly} variant="deck" />
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  onSelect,
  onBlocked,
  highlight,
  details,
  readOnly,
}: {
  row: WorkspaceRow;
  onSelect: (code: string, uldType: string) => void;
  onBlocked: (cell: WorkspaceCell) => void;
  highlight: Highlight | null;
  details: Map<string, CellDetail>;
  readOnly: boolean;
}) {
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
              <RowCells row={track} onSelect={onSelect} onBlocked={onBlocked} highlight={highlight} details={details} readOnly={readOnly} variant="row" />
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
  onBlocked,
  highlight,
  details,
  readOnly,
  variant,
}: {
  row: WorkspaceRow;
  onSelect: (code: string, uldType: string) => void;
  onBlocked: (cell: WorkspaceCell) => void;
  highlight: Highlight | null;
  details: Map<string, CellDetail>;
  readOnly: boolean;
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
      : // Every cell the same size, never sized by what is in it: a row
        // whose loaded positions are wider than its empty ones stops the
        // columns lining up between rows, and lining them up is how a
        // controller follows one position down the aircraft. Wide enough
        // for a ten-character ULD code on its own line, tall enough to
        // read across a ramp desk.
        "min-h-[86px] w-[96px] shrink-0 grow-0";

  return (
    <div ref={containerRef} className="contents" role="group" aria-label={row.label}>
      {row.cells.map((cell, index) => {
        const disabled = cell.state === "BLOCKED" || cell.state === "READ_ONLY";
        const label = [
          cell.code,
          t(`state.${cell.state}` as never),
          cell.weight ? formatWeight(cell.weight) : null,
          cell.uldCode,
          cell.blockedBy.length > 0
            ? t("blockedByList", {
                positions: cell.blockedBy.map((b) => `${b.code} (${b.rowLabel})`).join(", "),
              })
            : null,
        ]
          .filter(Boolean)
          .join(", ");

        // While the explanation is open, the two cells it names are ringed
        // — the position that cannot be used in the danger colour, the
        // loaded one holding its floor in the accent colour. Reading a
        // sentence about two codes is far harder than seeing them.
        const called =
          highlight === null
            ? ""
            : highlight.blockedKey === cell.key
              ? "ring-2 ring-inset ring-danger"
              : highlight.blockerKeys.includes(cell.key)
                ? "ring-2 ring-inset ring-info"
                : "opacity-30";

        return (
          <CellBox
            key={cell.key}
            cell={cell}
            detail={details.get(cell.key)}
            showDetails={variant === "row" && cell.state !== "BLOCKED"}
            className={`flex flex-col overflow-hidden rounded-md border transition ${sizing} ${called} ${
              variant === "deck" ? DECK_STATE_CLASS[cell.state] : STATE_CLASS[cell.state]
            }`}
          >
            <button
              data-cell
              type="button"
              // One tab stop per row; arrows move within it.
              tabIndex={index === 0 ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              // The header opens the rest of the assignment — AWB, content
              // code, the tare/net breakdown. A blocked cell explains
              // itself rather than swallowing the tap: the controller
              // clicked a real position and deserves to be told which
              // loaded position took it out of play.
              onClick={() =>
                cell.state === "BLOCKED"
                  ? onBlocked(cell)
                  : !disabled && onSelect(cell.code, cell.uldType)
              }
              aria-disabled={disabled}
              aria-label={label}
              title={label}
              className={`flex items-center justify-center gap-0.5 font-mono font-bold leading-none ${
                variant === "deck"
                  ? "h-full text-xs sm:text-sm"
                  : "h-6 w-full bg-slate-900 px-1 text-xs text-slate-50"
              } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {cell.code}
              <span aria-hidden="true" className="text-[10px] leading-none">
                {STATE_SYMBOL[cell.state]}
              </span>
            </button>
            {variant === "row" ? (
              cell.state === "BLOCKED" ? (
                <span className="flex w-full flex-1 items-center justify-center px-1 text-xs leading-tight text-fg-subtle">
                  {t("blockedShort")}
                </span>
              ) : (
                <CellFields cell={cell} rowLabel={row.label} readOnly={readOnly} />
              )
            ) : null}
          </CellBox>
        );
      })}
    </div>
  );
}

/** What the plate itself publishes about a position — everything here is
 * read from versioned AHM data, nothing is derived beyond arithmetic on
 * the controller's own entry. */
export interface CellDetail {
  indexPerKg: string;
  longitudinalInches: string | null;
  lateralInches: string | null;
}

/**
 * The cell's own box. Split out so it can hold the ref and the open state
 * the details panel needs — a cell in a list cannot own a hook otherwise.
 */
function CellBox({
  cell,
  detail,
  showDetails,
  className,
  children,
}: {
  cell: WorkspaceCell;
  detail: CellDetail | undefined;
  showDetails: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const open = () => {
    if (showDetails && ref.current) setAnchor(ref.current.getBoundingClientRect());
  };
  const close = () => setAnchor(null);

  return (
    <div
      ref={ref}
      data-cell-key={cell.key}
      className={className}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocusCapture={open}
      onBlurCapture={close}
    >
      {children}
      {anchor ? <CellDetails cell={cell} detail={detail} anchor={anchor} /> : null}
    </div>
  );
}

/**
 * The figures behind a position, while it is being filled in.
 *
 * Shown on focus and on hover, in a portal: each configuration row is its
 * own horizontal scroller with hidden overflow, so a panel rendered inside
 * a cell would be clipped exactly when it matters.
 *
 * Area load, running load and contour height are deliberately absent. The
 * operator's reference system prints them, but AHM 560 Ed.1 publishes no
 * floor-load table for this airframe — the panel says so instead of
 * estimating, because an estimated floor limit is a limit nobody checked
 * (CLAUDE.md rules #3 and #9).
 */
function CellDetails({
  cell,
  detail,
  anchor,
}: {
  cell: WorkspaceCell;
  detail: CellDetail | undefined;
  anchor: DOMRect;
}) {
  const t = useTranslations("loadPlan.workspace");
  const items = useLoadDraftStore((s) => s.items);
  const item = items.find((i) => i.position === cell.code) ?? null;

  const gross = cell.weight;
  const index = gross && detail ? positionIndex(gross, detail.indexPerKg) : null;
  const headroom = gross ? new Decimal(cell.maxGross).minus(new Decimal(gross)).toString() : cell.maxGross;

  const rows: [string, string][] = [
    [t("detailMaxLoad"), formatWeight(cell.maxGross)],
    ...(detail?.longitudinalInches && detail.lateralInches
      ? ([[t("detailFootprint"), `${detail.longitudinalInches} × ${detail.lateralInches}`]] as [string, string][])
      : []),
    ...(detail ? ([[t("detailIndexPerKg"), formatIndexPerKg(detail.indexPerKg)]] as [string, string][]) : []),
    ...(gross
      ? ([
          [t("detailGross"), formatWeight(gross)],
          ...(item?.tareWeight ? ([[t("detailTare"), formatWeight(item.tareWeight)]] as [string, string][]) : []),
          ...(item?.netWeight ? ([[t("detailNet"), formatWeight(item.netWeight)]] as [string, string][]) : []),
          ...(index ? ([[t("detailIndexNow"), formatIndex(index)]] as [string, string][]) : []),
          [t("detailHeadroom"), formatWeight(headroom)],
        ] as [string, string][])
      : []),
  ];

  // Anchored beside the cell: to its right where there is room, flipped to
  // its left where there is not. Clamping to the screen edge instead would
  // drop the panel on top of the cell it describes — which is what happened
  // to the last position in a row, and the panel then swallowed the click
  // meant for that cell, so the weight landed on whichever cell still had
  // focus: the same code on the other configuration row.
  // The panel's own height is not known until it is laid out; maxHeight is
  // the tallest it gets with every row present.
  const width = 260;
  const { left, top } = detailPanelPosition(
    anchor,
    { width: window.innerWidth, height: window.innerHeight },
    { width, maxHeight: 260, gap: 8 },
  );

  return createPortal(
    <div
      role="tooltip"
      // Read-only: it must never take a click away from the cell under it.
      style={{ position: "fixed", left, top, width, pointerEvents: "none" }}
      className="z-40 flex flex-col gap-1 rounded-lg border border-border bg-bg p-3 text-xs shadow-xl"
    >
      <span className="font-semibold text-fg">{t("detailsTitle", { position: cell.code })}</span>
      <span className="text-[11px] text-fg-subtle">{cell.rowLabel}</span>
      <dl className="mt-1 flex flex-col gap-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="font-mono tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {gross ? null : <span className="text-[11px] text-fg-subtle">{t("detailEmpty")}</span>}
      <p className="mt-1 border-t border-border pt-1 text-[11px] leading-snug text-fg-subtle">
        {t("detailUnavailable")}
      </p>
    </div>,
    document.body,
  );
}

/**
 * ULD and weight, typed straight into the cell.
 *
 * The plate is the working surface: a controller reads the row, finds the
 * position and writes what is on it. Sending them through a dialog for two
 * fields put a modal between them and the aircraft, and — because a dialog
 * only knows the position *code* — a code published on two mutually
 * exclusive rows could land the load on the wrong one. Typing in the cell
 * cannot: the cell is the row.
 *
 * Committed on blur and on Enter rather than on every keystroke, so a
 * half-typed weight never reaches the live W&B calculation. Escape puts
 * the cell back the way it was.
 */
function CellFields({
  cell,
  rowLabel,
  readOnly,
}: {
  cell: WorkspaceCell;
  rowLabel: string;
  readOnly: boolean;
}) {
  const t = useTranslations("loadPlan.workspace");
  const items = useLoadDraftStore((s) => s.items);
  const upsertItem = useLoadDraftStore((s) => s.upsertItem);
  const removeItem = useLoadDraftStore((s) => s.removeItem);

  const stored = items.find((item) => item.position === cell.code) ?? null;
  const [uldCode, setUldCode] = useState(cell.uldCode ?? "");
  const [weight, setWeight] = useState(cell.weight ?? "");
  // At rest the cell shows the code without its type prefix — the row
  // already says PALLET or SIDE BY SIDE, so "PMC" in every cell spends the
  // width that tells two units apart. Focusing gives the full code back,
  // because that is what is being edited and what the documents print.
  const [uldFocused, setUldFocused] = useState(false);

  // The plan can change underneath a cell — auto trim, a save coming back,
  // another tab — so the fields follow the draft while they are not being
  // edited.
  useEffect(() => {
    setUldCode(cell.uldCode ?? "");
    setWeight(cell.weight ?? "");
  }, [cell.uldCode, cell.weight]);

  const commit = (nextUldCode: string, nextWeight: string) => {
    const trimmedWeight = nextWeight.trim();
    const trimmedUld = nextUldCode.trim();

    if (trimmedWeight === "") {
      if (stored) removeItem(cell.code);
      return;
    }

    upsertItem({
      ...(stored ?? {}),
      position: cell.code,
      uldType: cell.uldType,
      weight: trimmedWeight,
      uldCode: trimmedUld === "" ? undefined : trimmedUld,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Arrow keys belong to the cell's own text while a field has focus —
    // they must not walk the row and steal what is being typed.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit(uldCode, weight);
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setUldCode(cell.uldCode ?? "");
      setWeight(cell.weight ?? "");
      event.currentTarget.blur();
    }
  };

  const field =
    "w-full min-w-0 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-center leading-tight " +
    "hover:border-border focus:bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 " +
    "disabled:cursor-not-allowed";

  return (
    <span className="flex w-full flex-1 flex-col justify-center gap-1 px-1 py-1.5">
      <input
        value={uldFocused ? uldCode : shortUldCode(uldCode)}
        onChange={(event) => setUldCode(event.target.value)}
        onFocus={() => setUldFocused(true)}
        onBlur={() => {
          setUldFocused(false);
          commit(uldCode, weight);
        }}
        onKeyDown={onKeyDown}
        disabled={readOnly}
        // The accessible name carries the full code: a screen reader has no
        // row heading in view to supply the prefix the display drops.
        aria-label={`${t("uldCodeFor", { position: cell.code, row: rowLabel })}${uldCode ? ` — ${uldCode}` : ""}`}
        placeholder={t("uldCodePlaceholder")}
        className={`${field} text-xs font-semibold placeholder:text-fg-subtle/60`}
      />
      <input
        value={weight}
        onChange={(event) => setWeight(event.target.value)}
        onBlur={() => commit(uldCode, weight)}
        onKeyDown={onKeyDown}
        disabled={readOnly}
        inputMode="decimal"
        aria-label={t("weightFor", { position: cell.code, row: rowLabel })}
        placeholder={t("weightPlaceholder")}
        className={`${field} text-sm font-semibold tabular-nums placeholder:text-fg-subtle/60`}
      />
    </span>
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
