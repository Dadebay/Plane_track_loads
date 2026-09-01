import type { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type { Direction, IndexFormula, StabRoundingRule, StabTrimPoint } from "./types";
import { truncate } from "./decimal-utils";

// AHM 560 s.15 §3.1
//   Index = W . (Sta - Ref.Sta) / C + K
//
// `station` here is the pre-resolved (Sta - Ref.Sta) style "arm from
// reference station" in meters, i.e. what @tua/ahm-data's position/crew
// tables call `indexPerKg`'s underlying arm. Positions in this system are
// looked up by their already-published `indexPerKg` (see formula.ts's
// sibling `indexContribution` helper used by wnb.ts), so this function
// exists for the general case: computing an index contribution directly
// from a weight and a station/arm, e.g. for BEW or ad-hoc arm data.
export function calculateIndex(weight: string, armFromRefSta: string, formula: IndexFormula): Decimal {
  const w = d(weight);
  const arm = d(armFromRefSta);
  const c = d(formula.c);
  const k = d(formula.k);
  return w.times(arm).dividedBy(c).plus(k);
}

// AHM 560 s.15-16 §3.1
//   %MAC = ( C.(I - K)/W + Ref.Sta - LEMAC ) / (MAC/100)
export function indexToMac(index: string, weight: string, formula: IndexFormula): Decimal {
  const i = d(index);
  const w = d(weight);
  const c = d(formula.c);
  const k = d(formula.k);
  const refStaMinusLemac = d(formula.refStaMinusLemac);
  const macOver100 = d(formula.macOver100);

  const moment = c.times(i.minus(k)).dividedBy(w);
  return moment.plus(refStaMinusLemac).dividedBy(macOver100);
}

/**
 * AHM 560 s.16 §3.4 — stabilizer trim setting from %MAC.
 *
 * `curve` is the 4-breakpoint table (documented flat below 21, linear
 * between 21 and 35, flat above 35 — GROUND_TRUTH.md §6). Direction for
 * any point strictly between two breakpoints is taken from the *lower*
 * breakpoint, except exactly at the upper breakpoint, where the upper
 * breakpoint's own direction applies. This reproduces the documented rule
 * "21 < %MAC < 35 -> ... Up" / "%MAC >= 35 -> ... Down" (the transition to
 * Down happens exactly at 35, not gradually) for the shipped 4-point curve,
 * and generalizes correctly to any similarly-shaped curve.
 *
 * Rounding: TRUNCATE to `rounding.decimals` places (GROUND_TRUTH.md §6:
 * formula gives 4.155 for T5 692, loadsheet prints 4.1 — truncation, not
 * rounding).
 */
export function macToStab(
  mac: string,
  curve: StabTrimPoint[],
  rounding: StabRoundingRule,
): { value: Decimal; direction: Direction } {
  const sorted = [...curve].sort((a, b) => d(a.mac).comparedTo(d(b.mac)));
  const x = d(mac);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    throw new Error("macToStab: curve must have at least one point");
  }

  const applyRounding = (v: Decimal): Decimal =>
    rounding.method === "TRUNCATE" ? truncate(v, rounding.decimals) : v;

  if (x.lte(d(first.mac))) {
    return { value: applyRounding(d(first.stab)), direction: first.direction };
  }
  if (x.gte(d(last.mac))) {
    return { value: applyRounding(d(last.stab)), direction: last.direction };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const ax = d(a.mac);
    const bx = d(b.mac);
    if (x.gte(ax) && x.lte(bx)) {
      if (x.eq(ax)) return { value: applyRounding(d(a.stab)), direction: a.direction };
      if (x.eq(bx)) return { value: applyRounding(d(b.stab)), direction: b.direction };
      const t = x.minus(ax).dividedBy(bx.minus(ax));
      const value = d(a.stab).plus(t.times(d(b.stab).minus(d(a.stab))));
      return { value: applyRounding(value), direction: a.direction };
    }
  }

  // Unreachable given the bounds checks above.
  throw new Error(`macToStab: could not bracket %MAC ${mac} in curve`);
}
