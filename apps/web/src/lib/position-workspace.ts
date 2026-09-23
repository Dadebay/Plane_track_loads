/**
 * The aircraft loading workspace, as data.
 *
 * The plate's rows come from @tua/wnb-core's `buildDeckLayout()` — the
 * same function the LIR and Loadsheet PDFs lay their position grids out
 * from, so screen and print cannot disagree about which positions exist
 * on a row or in what order. This module adds the part the documents do
 * not need: per-cell *state*, so the component only has to render.
 *
 * Kept out of the component on purpose: cell state is the part that has to
 * be right (a position shown as free when it is blocked is a loading error),
 * and a pure function is the part that can be tested.
 */

import {
  buildDeckLayout,
  conflictingPositionsFor,
  positionKey,
  type PositionFootprint,
} from "@tua/wnb-core";
import type { DraftLoadItem, LoadPlanAhmData } from "./load-plan-calc";

/**
 * Cell states, in the order they take precedence. Every one of them is
 * conveyed by a symbol and by the cell's accessible name as well as by
 * colour — CLAUDE.md's ramp-crew reality and the brief's "distinct and
 * accessible without relying on color alone".
 */
export type CellState = "EMPTY" | "LOADED" | "OVERLOADED" | "BLOCKED" | "READ_ONLY";

export interface BlockingPosition {
  /** `uldType/code` — lets the UI point at the blocking cell itself. */
  key: string;
  code: string;
  /** The configuration row the blocking position sits on, as printed. */
  rowLabel: string;
}

export interface WorkspaceCell {
  /** `uldType/code`, unique across the whole workspace. */
  key: string;
  code: string;
  uldType: string;
  /** The configuration row this cell is printed on, as the plate labels
   * it — the piece that tells two identically-coded cells apart. */
  rowLabel: string;
  state: CellState;
  /** Gross weight on this position, when loaded. */
  weight: string | null;
  uldCode: string | null;
  maxGross: string;
  /** What blocks this cell, when `state` is BLOCKED. The row matters as
   * much as the code: a code like `ABR` is published on two mutually
   * exclusive rows, so "blocked by ABR" alone reads as nonsense. */
  blockedBy: BlockingPosition[];
}

export interface WorkspaceRow {
  id: string;
  label: string;
  deck: "MAIN" | "LOWER";
  cells: WorkspaceCell[];
}

export interface Workspace {
  main: WorkspaceRow[];
  lower: WorkspaceRow[];
}

/** A code with only one published variant carries no `uldType` on the draft
 * item; resolve it so a cell key can always be formed. */
function resolveUldType(item: DraftLoadItem, ahmData: LoadPlanAhmData): string | null {
  if (item.uldType) return item.uldType;
  const matches = ahmData.positions.filter((p) => p.code === item.position);
  return matches.length === 1 ? matches[0]!.uldType : null;
}

/**
 * `conflicts` in wnb-core answers "which loaded positions clash with each
 * other". The workspace needs the other direction too: which *empty* cells a
 * loaded position takes out of play, so they can be shown as unavailable
 * before anyone tries to use them. That is one call per loaded position
 * against the full footprint set.
 */
function blockedByMap(
  loadedKeys: string[],
  footprints: PositionFootprint[],
  rowLabels: Map<string, string>,
): Map<string, BlockingPosition[]> {
  const allKeys = footprints.map((f) => f.key);
  const blockedBy = new Map<string, BlockingPosition[]>();

  for (const loaded of loadedKeys) {
    const [uldType, code] = loaded.split("/");
    for (const blocked of conflictingPositionsFor(loaded, allKeys, footprints)) {
      const list = blockedBy.get(blocked) ?? [];
      list.push({
        key: loaded,
        code: code ?? loaded,
        rowLabel: rowLabels.get(uldType ?? "") ?? uldType ?? "",
      });
      blockedBy.set(blocked, list);
    }
  }
  return blockedBy;
}

export function buildWorkspace(
  ahmData: LoadPlanAhmData,
  items: DraftLoadItem[],
  footprints: PositionFootprint[],
  overloaded: Set<string>,
  readOnly: boolean,
): Workspace {
  const loadedByKey = new Map<string, DraftLoadItem>();
  for (const item of items) {
    const uldType = resolveUldType(item, ahmData);
    if (uldType) loadedByKey.set(positionKey(uldType, item.position), item);
  }

  const layout = buildDeckLayout(ahmData.positions, ahmData.positionConfigurations);
  const rowLabels = new Map(
    [...layout.main, ...layout.lower].map((row) => [row.id, row.label] as const),
  );

  const blockedBy = blockedByMap([...loadedByKey.keys()], footprints, rowLabels);

  const decorate = (row: (typeof layout.main)[number]): WorkspaceRow => ({
    id: row.id,
    label: row.label,
    deck: row.deck,
    cells: row.cells.map((cell) => {
      const item = loadedByKey.get(cell.key);
      const blockers = blockedBy.get(cell.key) ?? [];

      let state: CellState;
      if (readOnly) state = "READ_ONLY";
      else if (item && overloaded.has(cell.code)) state = "OVERLOADED";
      else if (item) state = "LOADED";
      else if (blockers.length > 0) state = "BLOCKED";
      else state = "EMPTY";

      return {
        key: cell.key,
        code: cell.code,
        uldType: cell.uldType,
        rowLabel: row.label,
        state,
        weight: item?.weight ?? null,
        uldCode: item?.uldCode ?? null,
        maxGross: cell.maxGross,
        blockedBy: blockers,
      };
    }),
  });

  return {
    main: layout.main.map(decorate),
    lower: layout.lower.map(decorate),
  };
}

/**
 * Moves the roving focus inside a row of cells.
 *
 * Left/right walk the row and stop at its ends rather than wrapping, so a
 * controller holding an arrow key cannot silently jump from the tail of the
 * aircraft back to the nose.
 */
export function nextCellIndex(current: number, count: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, current - 1);
    case "ArrowRight":
      return Math.min(count - 1, current + 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
