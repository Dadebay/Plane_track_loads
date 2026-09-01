/**
 * IATA Type B teleprinter formatting helpers, shared by every message
 * encoder in this package (AHM 583/388/587/011/780).
 *
 * Type B convention (SITA/IATA AHM message specimens): dates are DDMMM
 * with no year, times are HHMM UTC with no separator, weights are whole
 * kilograms with no thousands separator and no decimal point, and message
 * text is uppercase and word-wrapped at a fixed line length.
 */

import { Decimal } from "decimal.js";

/** Conventional max line length for a Type B teleprinter line. */
export const TYPE_B_LINE_LENGTH = 69;

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

/** ISO date ("2026-08-11") -> Type B date ("11AUG"). */
export function toTypeBDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`invalid ISO date: ${isoDate}`);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`invalid ISO date: ${isoDate}`);
  return `${m[3]}${MONTHS[monthIndex]}`;
}

/** "HH:mm" or "HHmm" -> Type B time ("2200"), always UTC. */
export function toTypeBTime(time: string): string {
  const digits = time.replace(":", "");
  if (!/^([01]\d|2[0-3])[0-5]\d$/.test(digits)) throw new Error(`invalid time: ${time}`);
  return digits;
}

/**
 * Rounds a weight to whole kilograms for wire format — Type B messages
 * carry no fractional weights, unlike the decimal-precision figures used
 * internally by @tua/wnb-core and shown on the Loadsheet/LIR.
 */
export function toTypeBWeight(weight: string | Decimal): string {
  const value = weight instanceof Decimal ? weight : new Decimal(weight);
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
}

/** Uppercases and collapses whitespace — Type B free text has no lowercase. */
export function toTypeBText(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Word-wraps free text (e.g. an SI field) to the Type B line length without breaking words. */
export function wrapTypeBText(text: string, maxLength: number = TYPE_B_LINE_LENGTH): string[] {
  const words = toTypeBText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Joins message lines with the CRLF line ending conventional for Type B relay. */
export function joinTypeBLines(lines: string[]): string {
  return lines.join("\r\n");
}
