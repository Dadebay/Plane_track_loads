import { Decimal } from "decimal.js";

/** Parses a decimal string (as produced by @tua/ahm-data) into a Decimal. */
export function d(value: string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Truncates (rounds toward zero) a Decimal to `decimals` places — the AHM
 * 560 STAB rounding rule (AHM 560 s.16, GROUND_TRUTH.md §6: 4.155 -> 4.1,
 * not banker's/half-up rounding).
 */
export function truncate(value: Decimal, decimals: number): Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_DOWN);
}

/**
 * Linear interpolation of `y` at `x` between two known points.
 * Used throughout for AHM 560 breakpoint tables (fuel index, CG limits) —
 * every one of these tables is documented as requiring linear interpolation
 * between adjacent rows, never extrapolation beyond the table's ends.
 */
export function lerp(x: Decimal, x0: Decimal, y0: Decimal, x1: Decimal, y1: Decimal): Decimal {
  if (x1.eq(x0)) return y0;
  return y0.plus(x.minus(x0).times(y1.minus(y0)).dividedBy(x1.minus(x0)));
}

/** Standard round-half-up to `decimals` places — used for %MAC display (unlike STAB, which truncates). */
export function roundHalfUp(value: Decimal, decimals: number): Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}
