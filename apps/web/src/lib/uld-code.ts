/**
 * IATA ULD naming convention (AHM 810 / Faz 7 görev 4): 3-letter type
 * code + 4-5 digit serial number + owner code, all uppercase, no
 * separators — e.g. "PMC12345TU", "PMC06475T5".
 *
 * The owner code is an airline designator and those are alphanumeric, not
 * alphabetic: Turkmenistan Airlines is **T5**. Requiring letters rejected
 * the operator's entire fleet — every ULD on their own loadsheets ends in
 * T5 — so the convention check would have refused real units on the ramp.
 * Ground truth over inference (CLAUDE.md rule #9).
 *
 * It must still begin with a letter, which is what keeps the split
 * unambiguous: without that, "PMC123456TU" parses as a 5-digit serial and
 * an owner of "6TU" instead of being reported as the malformed code it is.
 * The cost is a designator that starts with a digit (9W, 5X) — no such
 * carrier is in scope here, and widening the rule for one would be
 * inventing a convention rather than reading it.
 */

const ULD_CODE_PATTERN = /^([A-Z]{3})(\d{4,5})([A-Z][A-Z0-9]{1,2})$/;

export interface ParsedUldCode {
  typeCode: string;
  serial: string;
  ownerCode: string;
}

export function parseUldCode(code: string): ParsedUldCode | null {
  const match = ULD_CODE_PATTERN.exec(code.trim().toUpperCase());
  if (!match) return null;
  const [, typeCode, serial, ownerCode] = match;
  return { typeCode: typeCode!, serial: serial!, ownerCode: ownerCode! };
}

export function isValidUldCode(code: string): boolean {
  return parseUldCode(code) !== null;
}

export function buildUldCode(typeCode: string, serial: string, ownerCode: string): string {
  return `${typeCode.trim().toUpperCase()}${serial.trim()}${ownerCode.trim().toUpperCase()}`;
}

/**
 * The part of a ULD code a plate cell shows: serial and owner, without the
 * 3-letter type code.
 *
 * The type code is the one part of the code the plate already states — a
 * PMC can only sit on a pallet row — so repeating it in every cell spends
 * the width that tells two units apart. The full code stays what is stored
 * and what the documents print; this is display only, and it is given back
 * in full the moment the field is focused for editing.
 *
 * A code that does not parse is returned untouched rather than trimmed by
 * position: a controller may be part-way through typing one, and cutting
 * three characters off an unrecognized string would hide their own input.
 */
export function shortUldCode(code: string): string {
  const parsed = parseUldCode(code);
  return parsed ? `${parsed.serial}${parsed.ownerCode}` : code;
}
