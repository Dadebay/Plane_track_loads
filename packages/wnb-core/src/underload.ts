import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type { WeightLimits } from "./types";

/**
 * AHM 560 s.3/s.48 weight limits — UNDERLOAD BEFORE LMC = the most
 * restrictive of the three margins to MZFW/MTOW/MLW.
 *
 * GROUND_TRUTH.md Bulgu #1: the real T5 692 loadsheet prints 24722 kg,
 * computed from a DOW rounded to 110000 kg instead of the actual
 * 111043.70 kg — a 1043.7 kg overstatement in the airline's favour, which
 * is a safety-relevant error (a load controller could accept excess load
 * believing there's more margin than there is). This function always uses
 * the exact, unrounded ZFW/TOW/LDW — see golden-t5692.test.ts's
 * "corrects Aerometa's rounding bug" test.
 */
export function calculateUnderload(
  zfw: string,
  tow: string,
  ldw: string,
  limits: Pick<WeightLimits, "mzfw" | "mtow" | "mlw">,
): Decimal {
  const zfwMargin = d(limits.mzfw).minus(d(zfw));
  const towMargin = d(limits.mtow).minus(d(tow));
  const ldwMargin = d(limits.mlw).minus(d(ldw));
  return Decimal.min(zfwMargin, towMargin, ldwMargin);
}
