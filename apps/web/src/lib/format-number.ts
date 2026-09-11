/**
 * Weight and index formatting for the UI.
 *
 * CLAUDE.md: the weight format is locale-independent — thin space for the
 * thousands separator, comma for the decimal (`1 234,5`) — in all three UI
 * languages, because that is what the printed AHM 560 tables and the
 * loadsheets use. Never route these through `Intl.NumberFormat` with the
 * active locale; `ru` would give `1 234,5` but `en` would give `1,234.5`
 * and the ramp crew would be reading two different formats on one screen.
 *
 * Input is always a decimal *string* (see @tua/ahm-data). `formatWeight`
 * only reshapes digits; `formatIndex` also rounds to the 2 decimals the AHM
 * prints, because interpolated values (CG envelope limits) reach the UI with
 * the full quotient still on them.
 */

import { Decimal } from "decimal.js";

/** U+00A0 — keeps "1 234" from wrapping across a line break. */
const THOUSANDS_SEPARATOR = " ";

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
}

/** `"1234.5"` -> `"1 234,5"`. Trailing zeros of the input are preserved. */
export function formatWeight(value: string): string {
  const sign = value.startsWith("-") ? "-" : "";
  const [whole = "0", fraction] = value.replace(/^[-+]/, "").split(".");
  return sign + group(whole) + (fraction ? `,${fraction}` : "");
}

/**
 * Index units, always signed and always to exactly 2 decimals — the AHM
 * tables and the loadsheet both print index this way, and an unsigned index
 * is ambiguous about which way the load moves the CG.
 *
 * Rounds here rather than trusting the caller. Some index values reach the
 * UI already rounded (calculateWnb's own output), but a CG envelope limit is
 * interpolated between two published breakpoints and arrives with the full
 * quotient still on it — `+86.5239953703703703837`, which is unreadable and
 * not the format CLAUDE.md prescribes. Rounding in the presentation layer is
 * exactly where rule #2 allows it, and doing it here fixes every call site at
 * once instead of leaving the next one to rediscover the problem.
 */
export function formatIndex(value: string): string {
  const rounded = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  // `-0.004` rounds to a negative zero; print it as a neutral +0,00 rather
  // than a −0,00 that reads like a real aft shift.
  const negative = rounded.isNegative() && !rounded.isZero();
  return (negative ? "−" : "+") + formatWeight(rounded.abs().toFixed(2));
}
