import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type { CargoIndexTable, Position } from "./types";

/**
 * AHM 560 — "CARGO LOADING INDEX TABLE": the laminated card the loadmaster
 * reads by hand. Rows are total main + lower load per loading zone in 500 kg
 * brackets; cells are whole index units.
 *
 * The card is never an input to a calculation. `positionIndex` computes the
 * same quantity exactly from the position's published index-per-kg (AHM 560
 * s.15 §3.1); the card is that quantity rounded to whole units over a 500 kg
 * bracket. It is kept so the screen can show the loadmaster the number they
 * would have read off the card, and so an AHM revision that moves the
 * position table without reissuing the card gets caught.
 */

/** Every printed bracket is 500 kg wide, so a weight can sit up to 250 kg
 * away from the midpoint the card's cell stands for. */
const HALF_BRACKET = 250;

/** Whole-unit print rounding. One unit, not half: the card's author rounded
 * at an unstated point within each bracket, so the error can land either
 * side of a half unit. */
const PRINT_ROUNDING = 1;

/** The card's per-column slope tracks its zone's published index-per-kg to
 * within 20% — pinned by `cargo index card vs positions.json` in
 * position-index.test.ts. Scales with weight, because a slope difference
 * compounds the further up the column you read. */
const SLOPE_ALLOWANCE = 0.2;

export interface CardCrossCheck {
  /** The card's zone letter (A..U, skipping I/N/O/Q). */
  zone: string;
  /** Total load attributed to the zone. */
  weight: string;
  /** The exact index for that weight at the zone's published index-per-kg. */
  computed: string;
  /** The card's whole-unit value, or null where the card leaves the cell
   * blank (the bracket is above the zone's maximum load). */
  printed: string | null;
  /** How far the two may legitimately differ — see `cardTolerance`. */
  tolerance: string;
  /** True only when the gap exceeds what the card's own resolution can
   * account for. Never true from rounding alone. */
  disagrees: boolean;
}

export function lookupCargoIndex(
  zone: string,
  weight: string | Decimal,
  table: CargoIndexTable,
): string | null {
  const w = d(weight);
  if (w.lte(0)) return null;

  let lastPrinted: Decimal | null = null;
  for (const bracket of table.brackets) {
    const printed = bracket.index[zone];
    if (printed !== undefined) lastPrinted = d(bracket.to);
    if (w.gte(d(bracket.from)) && w.lte(d(bracket.to))) {
      if (printed !== undefined) return printed;
      break;
    }
  }

  // Past the zone's last printed bracket the card greys the column out and
  // the loadmaster reads the MAX row instead. A weight below the column's
  // start has no cell at all.
  if (lastPrinted !== null && w.gt(lastPrinted)) return table.max[zone] ?? null;
  const lastRow = table.brackets.at(-1)?.to;
  return lastRow !== undefined && w.gt(d(lastRow)) ? (table.max[zone] ?? null) : null;
}

/**
 * How far the card may legitimately sit from the exact figure at a given
 * weight — three effects, none of them hand-tuned to make the data pass:
 *
 *  - `HALF_BRACKET x |indexPerKg|` — the weight's distance from the
 *    midpoint its cell stands for.
 *  - `PRINT_ROUNDING` — the cell is a whole number.
 *  - `SLOPE_ALLOWANCE x |indexPerKg| x weight` — the card's column slope
 *    is a hand-drawn approximation of the position's index-per-kg, and a
 *    slope difference compounds with weight.
 *
 * Across the whole printed card the widest real gap uses 79% of this
 * budget, so a disagreement past it is a real one: the card and
 * `positions.json` describe different AHM revisions, or one of them is
 * mistranscribed.
 */
export function cardTolerance(indexPerKg: string | Decimal, weight: string | Decimal): string {
  const ipk = d(indexPerKg).abs();
  return ipk
    .times(HALF_BRACKET)
    .plus(PRINT_ROUNDING)
    .plus(ipk.times(d(weight)).times(SLOPE_ALLOWANCE))
    .toFixed(2);
}

/**
 * Compares the exact per-zone index against the card, for every zone that
 * carries load.
 *
 * `zoneTotals` is keyed "ZA".."ZU" (as `expandLoadToZones` produces); the
 * card's columns are the bare letters. Zones with no matching single-letter
 * position — and zones the card leaves blank — are reported with
 * `printed: null` rather than dropped, so the caller can render a complete
 * list.
 */
export function crossCheckCargoIndexCard(
  zoneTotals: Record<string, string>,
  positions: Position[],
  table: CargoIndexTable,
): CardCrossCheck[] {
  const byCode = new Map(positions.map((p) => [p.code, p]));
  const rows: CardCrossCheck[] = [];

  for (const [zoneKey, weight] of Object.entries(zoneTotals)) {
    const zone = zoneKey.startsWith("Z") ? zoneKey.slice(1) : zoneKey;
    const w = d(weight);
    if (w.lte(0)) continue;

    const position = byCode.get(zone);
    if (!position) continue;

    const computed = w.times(d(position.indexPerKg));
    const printed = lookupCargoIndex(zone, w, table);
    const tolerance = cardTolerance(position.indexPerKg, w);

    rows.push({
      zone,
      weight: w.toString(),
      computed: computed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      printed,
      tolerance,
      disagrees: printed !== null && computed.minus(d(printed)).abs().gt(d(tolerance)),
    });
  }

  return rows.sort((a, b) => a.zone.localeCompare(b.zone));
}
