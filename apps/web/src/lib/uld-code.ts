/**
 * IATA ULD naming convention (AHM 810 / Faz 7 görev 4): 3-letter type
 * code + 4-5 digit serial number + 2-3 letter owner/airline code, all
 * uppercase, no separators — e.g. "PMC12345TU".
 */

const ULD_CODE_PATTERN = /^([A-Z]{3})(\d{4,5})([A-Z]{2,3})$/;

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
