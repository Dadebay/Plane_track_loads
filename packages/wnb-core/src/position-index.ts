import { Decimal } from "decimal.js";
import { d, roundHalfUp } from "./decimal-utils";
import { PositionNotFoundError } from "./errors";
import type { LoadItem, Position } from "./types";

/** Index units are published and printed to 2 decimals throughout AHM 560. */
const INDEX_DECIMALS = 2;

export interface PositionIndexRow {
  position: string;
  /** Total weight loaded in this position, summed over every item in it. */
  weight: string;
  /** The position's published index per kg (AHM 560 s.57-67 Sheet 14 §10). */
  indexPerKg: string;
  /** weight x indexPerKg, rounded to 2 dp for display. */
  index: string;
}

export interface PositionIndexBreakdown {
  rows: PositionIndexRow[];
  /** Sum of every row's *unrounded* index — the deadload index that
   * `calculateWnb` adds to DOI to get LIZFW. Summing the rounded rows
   * instead would drift by up to 0.005 per occupied position. */
  totalIndex: string;
  /** Sum of every row's weight — TOTAL TRAFFIC LOAD. */
  totalWeight: string;
}

/**
 * AHM 560 s.57-67 Sheet 14 §10 — the index contribution of a single
 * position, which is what the printed "Cargo Loading Index Table" gives in
 * 500 kg brackets and what a loadmaster reads off it by hand.
 *
 * We compute it exactly instead of by bracket lookup: index-per-kg is
 * already (arm - Ref.Sta)/C for that position (AHM 560 s.15 §3.1), so the
 * product is the same quantity the table approximates, only without the
 * bracket rounding — see cargo-index-table.ts for why the two are shown
 * side by side but never equated automatically.
 */
export function positionIndex(weight: string | Decimal, indexPerKg: string | Decimal): string {
  return roundHalfUp(d(weight).times(d(indexPerKg)), INDEX_DECIMALS).toFixed(INDEX_DECIMALS);
}

/**
 * Per-position index breakdown for the load-plan UI's live panel — the
 * screen equivalent of the operator's manual spreadsheet, where each
 * position's kg is typed in and its index units are looked up by hand.
 *
 * Positions with several items (a position can hold more than one AWB) are
 * collapsed into one row, because the index is linear in weight and the
 * printed table is read per position, not per AWB.
 *
 * Throws PositionNotFoundError for an item in a position `positions` does
 * not describe — same contract as `calculateWnb`'s deadloadIndex, so the
 * live panel and the saved calculation can never disagree about which
 * positions are valid.
 */
export function calculatePositionIndexes(
  loadItems: LoadItem[],
  positions: Position[],
): PositionIndexBreakdown {
  const positionByCode = new Map(positions.map((p) => [p.code, p]));

  const weightByPosition = new Map<string, Decimal>();
  const order: string[] = [];
  for (const item of loadItems) {
    if (!positionByCode.has(item.position)) throw new PositionNotFoundError(item.position);
    if (!weightByPosition.has(item.position)) order.push(item.position);
    weightByPosition.set(item.position, (weightByPosition.get(item.position) ?? new Decimal(0)).plus(d(item.weight)));
  }

  const rows: PositionIndexRow[] = [];
  let totalIndex = new Decimal(0);
  let totalWeight = new Decimal(0);

  for (const code of order) {
    const pos = positionByCode.get(code)!;
    const weight = weightByPosition.get(code)!;
    totalIndex = totalIndex.plus(weight.times(d(pos.indexPerKg)));
    totalWeight = totalWeight.plus(weight);
    rows.push({
      position: code,
      weight: weight.toString(),
      indexPerKg: pos.indexPerKg,
      index: positionIndex(weight, pos.indexPerKg),
    });
  }

  return {
    rows,
    totalIndex: roundHalfUp(totalIndex, INDEX_DECIMALS).toFixed(INDEX_DECIMALS),
    totalWeight: totalWeight.toString(),
  };
}
