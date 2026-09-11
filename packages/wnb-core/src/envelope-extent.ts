import type { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type { CgBreakpoint, CgLimitCurve } from "./types";

/**
 * The drawing extent of a CG envelope chart, as data.
 *
 * The ENV PDF (@tua/documents) and the live chart in the load-plan
 * workspace have to show the *same* envelope: same breakpoints, same axis
 * range, same tick marks. Anything else means a controller sees one picture
 * on screen and prints another. This module is that single source — it
 * takes the AHM `cgLimits` curves plus the plotted points and answers "what
 * range must the axes cover, and where do the ticks fall".
 *
 * Deliberately data-space only: no pixels, no colours, no framework. Each
 * renderer maps this onto its own canvas. Every number is a Decimal string
 * (CLAUDE.md rule #2) — the axis bounds are derived from AHM weights and
 * indexes, so they are computed the same way as the values they frame, and
 * rounding to a tick step is the only arithmetic performed here.
 *
 * The tick steps themselves are a presentation choice (how coarse the grid
 * should be), not an AHM 560 value, so they are plain defaults the caller
 * may override — CLAUDE.md rule #3 governs AHM limits, not grid spacing.
 */

export interface EnvelopeExtentPoint {
  weight: string;
  index: string;
}

export interface EnvelopeExtent {
  indexMin: string;
  indexMax: string;
  weightMin: string;
  weightMax: string;
  /** Inclusive tick values, ascending, at `indexStep` / `weightStep`. */
  indexTicks: string[];
  weightTicks: string[];
}

export interface EnvelopeExtentInput {
  /** Every limit curve that will be drawn. */
  curves: CgLimitCurve[];
  /** Plotted CG points (ZFCG/TOCG/LDCG and any corrected point). */
  points: EnvelopeExtentPoint[];
  /** Weight-axis reference lines (MLW, minimum operating weight). */
  weightReferences?: string[];
  /** Defaults: index 10 units, weight 20 000 kg. */
  indexStep?: string;
  weightStep?: string;
  /** `[min, max]` the axis must cover even when the data is narrower — the
   * chart the crew is used to reading is drawn on a fixed frame, and a
   * chart whose axis moves with the load is harder to compare between
   * flights. It can only ever widen the axis: data outside this range
   * still sets the bound, so no curve can be clipped. */
  minimumIndexRange?: [string, string];
  minimumWeightRange?: [string, string];
}

const DEFAULT_INDEX_STEP = "10";
const DEFAULT_WEIGHT_STEP = "20000";

function floorToStep(value: Decimal, step: Decimal): Decimal {
  return value.dividedBy(step).floor().times(step);
}

function ceilToStep(value: Decimal, step: Decimal): Decimal {
  return value.dividedBy(step).ceil().times(step);
}

/** Step multiples that fall inside [min, max], ascending. The bounds
 * themselves are the data's own, so the first and last tick sit inside the
 * axis rather than defining it. */
function ticks(min: Decimal, max: Decimal, step: Decimal): string[] {
  const out: string[] = [];
  for (let tick = ceilToStep(min, step); tick.lte(max); tick = tick.plus(step)) {
    out.push(tick.toString());
  }
  return out;
}

/** Breakpoints in ascending weight order — the order a polyline must be
 * drawn in. AHM tables are printed that way already; this makes it a
 * guarantee rather than an assumption about the JSON's row order. */
export function sortBreakpointsByWeight(points: CgBreakpoint[]): CgBreakpoint[] {
  return [...points].sort((a, b) => d(a.weight).comparedTo(d(b.weight)));
}

export function buildEnvelopeExtent(input: EnvelopeExtentInput): EnvelopeExtent {
  const indexStep = d(input.indexStep ?? DEFAULT_INDEX_STEP);
  const weightStep = d(input.weightStep ?? DEFAULT_WEIGHT_STEP);

  const breakpoints = input.curves.flatMap((curve) => [...curve.forward, ...curve.aft]);
  const weights = [
    ...breakpoints.map((p) => d(p.weight)),
    ...input.points.map((p) => d(p.weight)),
    ...(input.weightReferences ?? []).map((w) => d(w)),
  ];
  const indexes = [...breakpoints.map((p) => d(p.index)), ...input.points.map((p) => d(p.index))];

  if (weights.length === 0 || indexes.length === 0) {
    throw new Error("buildEnvelopeExtent needs at least one curve breakpoint or plotted point");
  }

  const min = (values: Decimal[]) => values.reduce((a, b) => (a.lt(b) ? a : b));
  const max = (values: Decimal[]) => values.reduce((a, b) => (a.gt(b) ? a : b));

  // The axis ends at the data, not at the next round number. Rounding the
  // bounds outward left a band of empty chart below the minimum operating
  // weight — space that says nothing and shrinks the envelope the reader is
  // actually comparing against. Ticks still land on round values (see
  // `ticks`), so nothing is lost but the dead margin.
  const indexMin = min([...indexes, ...(input.minimumIndexRange ? [d(input.minimumIndexRange[0])] : [])]);
  const indexMax = max([...indexes, ...(input.minimumIndexRange ? [d(input.minimumIndexRange[1])] : [])]);
  const weightMin = min([...weights, ...(input.minimumWeightRange ? [d(input.minimumWeightRange[0])] : [])]);
  const weightMax = max([...weights, ...(input.minimumWeightRange ? [d(input.minimumWeightRange[1])] : [])]);

  return {
    indexMin: indexMin.toString(),
    indexMax: indexMax.toString(),
    weightMin: weightMin.toString(),
    weightMax: weightMax.toString(),
    indexTicks: ticks(indexMin, indexMax, indexStep),
    weightTicks: ticks(weightMin, weightMax, weightStep),
  };
}
