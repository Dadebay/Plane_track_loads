/**
 * One spelling for a flight number.
 *
 * The filter has always read a flight number the way a schedule prints it —
 * carrier code, then the digits — while the entry form took one free-text
 * box. A controller who typed "T5-692" there created a flight the filter
 * could not find: it searches for "T5 692", and the stored text does not
 * contain that. The form now has the same two controls, and both sides go
 * through here, so there is a single canonical spelling: `T5 692`.
 *
 * Flights entered before that still exist with their own spelling, so a
 * search also tries the compact and hyphenated forms rather than hiding
 * them.
 */

const CARRIER_PREFIX = /^([A-Za-z][A-Za-z0-9])\s*[-\s]?\s*(.*)$/;

/** Splits "T5-692", "T5 692" or "T5692" into its two controls. Text with no
 * carrier prefix stays entirely in the number box. */
export function splitFlightNo(value: string): { prefix: string; number: string } {
  const match = CARRIER_PREFIX.exec(value.trim());
  if (!match) return { prefix: "", number: value.trim() };
  return { prefix: match[1]!.toUpperCase(), number: match[2]!.trim() };
}

/** The canonical spelling: `T5 692`. A number with no carrier is left as the
 * controller typed it rather than being decorated with a space. */
export function formatFlightNo(prefix: string, number: string): string {
  return [prefix.trim().toUpperCase(), number.trim()].filter(Boolean).join(" ");
}

/** Re-spells any input into the canonical form — used on save, so what the
 * list searches for and what the database holds cannot drift apart. */
export function normalizeFlightNo(value: string): string {
  const { prefix, number } = splitFlightNo(value);
  return formatFlightNo(prefix, number);
}

/**
 * The spellings a search should accept for one flight number: canonical,
 * compact and hyphenated. Rows written before the form was fixed carry the
 * other two, and a controller looking for a flight they filed last week
 * should not have to guess which.
 */
export function flightNoSearchVariants(value: string): string[] {
  const canonical = normalizeFlightNo(value);
  if (!canonical) return [];
  const { prefix, number } = splitFlightNo(canonical);
  if (!prefix || !number) return [canonical];
  return [...new Set([canonical, `${prefix}${number}`, `${prefix}-${number}`])];
}

/**
 * The carrier code of a flight number, or null when the text is not shaped
 * like one.
 *
 * The code offered in the pickers is read out of the schedule rather than
 * hardcoded, so a carrier the operator starts filing appears on its own.
 * That also let rows left behind by automated tests — `FUEL13ef07`,
 * `TEST28175dcc`, `PERSd8ea4e75` — contribute FU, TE and PE to the list, as
 * if the airline flew them. A flight number is a two-character carrier code
 * followed by digits; anything else carries no carrier.
 */
export function carrierPrefixOf(flightNo: string): string | null {
  const match = /^([A-Za-z][A-Za-z0-9])\s*[-\s]?\s*(\d+)$/.exec(flightNo.trim());
  return match ? match[1]!.toUpperCase() : null;
}

/** The codes the pickers offer, in the order they are shown. */
export function carrierPrefixes(flightNumbers: readonly string[]): string[] {
  return [...new Set(flightNumbers.map(carrierPrefixOf).filter((p): p is string => p !== null))].sort();
}
