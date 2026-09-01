import type { Decimal } from "decimal.js";
import { d, lerp } from "./decimal-utils";
import type { CgBreakpoint, CgLimitCurve, EnvelopeCheck, WnbPhase } from "./types";

/** Exported for trim-optimizer.ts, which needs the raw forward/aft limit
 * at a fixed ZFW to compute the envelope's center as an optimization
 * target — everything else here stays package-internal. */
export function interpolateCurve(weight: Decimal, curve: CgBreakpoint[], label: string): Decimal {
  if (curve.length === 0) {
    throw new Error(`CG limit curve "${label}" has no breakpoints`);
  }
  const points = curve
    .map((p) => ({ weight: d(p.weight), index: d(p.index) }))
    .sort((a, b) => a.weight.comparedTo(b.weight));

  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (weight.lt(first.weight) || weight.gt(last.weight)) {
    throw new Error(
      `weight ${weight.toString()} is outside the ${label} CG limit table range ` +
        `[${first.weight.toString()}, ${last.weight.toString()}] — extrapolation is forbidden`,
    );
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (weight.gte(a.weight) && weight.lte(b.weight)) {
      if (weight.eq(a.weight)) return a.index;
      if (weight.eq(b.weight)) return b.index;
      return lerp(weight, a.weight, a.index, b.weight, b.index);
    }
  }
  throw new Error(`could not bracket weight ${weight.toString()} in ${label} CG limit table`);
}

/**
 * AHM 560 s.49-50 §6.2 — CG envelope check for ZFW/TOW/LDW.
 *
 * Forward and aft limits are linearly interpolated from the AHM breakpoint
 * tables for the given weight, per GROUND_TRUTH.md §10. No landing-phase
 * table is published in AHM 560 — callers must pass a `landing` curve
 * (e.g. the ZFW curve extended to MLW, pending the open question in
 * GROUND_TRUTH.md §21 Q3) or this throws when the curve is empty.
 *
 * This function reports (never throws for a business-rule violation) so
 * it can drive live UI feedback during load planning (Faz 8's "canlı
 * ihlal uyarıları"). `calculateWnb` is the one that turns a failing
 * `withinEnvelope: false` into a thrown `CgOutOfEnvelopeError` at
 * save/finalize time.
 */
export function checkEnvelope(
  weight: string,
  index: string,
  phase: WnbPhase,
  curve: CgLimitCurve,
): EnvelopeCheck {
  const w = d(weight);
  const i = d(index);

  const forwardLimit = interpolateCurve(w, curve.forward, `${phase} forward`);
  const aftLimit = interpolateCurve(w, curve.aft, `${phase} aft`);

  const withinEnvelope = i.gte(forwardLimit) && i.lte(aftLimit);

  return {
    phase,
    weight,
    index,
    forwardLimit: forwardLimit.toString(),
    aftLimit: aftLimit.toString(),
    withinEnvelope,
  };
}
