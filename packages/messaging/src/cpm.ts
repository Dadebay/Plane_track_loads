/**
 * CPM — Container/Pallet Message.
 *
 * Dispatch direction (AHM 388): per-position ULD/pallet/loose-AWB detail,
 * finer-grained than LDM's compartment totals — sent so the next station
 * knows exactly what is in each position before physically breaking down
 * the load.
 *
 * Acceptance direction (AHM 587, "acceptance only" per CLAUDE.md/plan
 * scope — TUA only ever receives this variant, e.g. from an interline
 * partner confirming what they loaded): parseCpmAcceptance reads an
 * incoming message back into structured position rows.
 */

import { toTypeBDate, toTypeBWeight, wrapTypeBText } from "./format-utils";
import type { CpmDispatchInput, ParsedCpmAcceptance, ParsedCpmPositionLoad } from "./types";

function encodePositionLoad(p: { position: string; uldCode?: string; awb?: string; weight: string; contentCode?: string }): string {
  const identifier = p.uldCode ?? p.awb ?? "NIL";
  const code = p.contentCode ?? "";
  return `${p.position}/${identifier}/${toTypeBWeight(p.weight)}/${code}`;
}

export function encodeCpmDispatch(input: CpmDispatchInput): string {
  const { flight } = input;
  const lines: string[] = [];

  lines.push("CPM");
  lines.push(`${flight.flightNo}${input.editionSuffix ?? ""}/${toTypeBDate(flight.date)}.${flight.origin}${flight.destination}`);

  for (const position of input.positions) {
    lines.push(encodePositionLoad(position));
  }

  if (input.specialInformation) {
    lines.push("SI");
    lines.push(...wrapTypeBText(input.specialInformation));
  }

  return lines.join("\r\n");
}

/**
 * Parses an incoming CPM (acceptance only — AHM 587). Tolerant of a
 * missing content code (trailing empty field) and of CRLF or bare LF line
 * endings. Throws on a message that isn't recognizably a CPM.
 */
export function parseCpmAcceptance(text: string): ParsedCpmAcceptance {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const identifierLine = lines[0];
  const flightLine = lines[1];
  if (identifierLine === undefined || flightLine === undefined || identifierLine.toUpperCase() !== "CPM") {
    throw new Error("not a CPM message: expected first line 'CPM'");
  }

  const flightLineMatch = /^([A-Z0-9]+)\/(\d{2}[A-Z]{3})\.([A-Z]{3})([A-Z]{3})$/.exec(flightLine);
  if (!flightLineMatch) {
    throw new Error(`unrecognized CPM flight line: "${flightLine}"`);
  }
  // Non-null: every group in flightLineMatch's pattern is mandatory (no `?`), so a
  // successful match guarantees all four captures are present.
  const flightNoRaw = flightLineMatch[1]!;
  const typeBDate = flightLineMatch[2]!;
  const origin = flightLineMatch[3]!;
  const destination = flightLineMatch[4]!;

  const positions: ParsedCpmPositionLoad[] = [];
  let specialInformation: string[] | null = null;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!; // in-bounds: i < lines.length
    if (line.toUpperCase() === "SI") {
      specialInformation = lines.slice(i + 1);
      break;
    }
    const parts = line.split("/");
    if (parts.length < 3) continue; // malformed line — skip rather than abort the whole parse
    const [position, identifier, weight, contentCode] = parts as [string, string, string, string?];
    positions.push({
      position,
      uldCode: identifier && identifier !== "NIL" ? identifier : null,
      awb: null,
      weight,
      contentCode: contentCode && contentCode.length > 0 ? contentCode : null,
    });
  }

  return {
    flightNo: flightNoRaw,
    date: typeBDateToIso(typeBDate),
    origin,
    destination,
    positions,
    specialInformation: specialInformation && specialInformation.length > 0 ? specialInformation.join(" ") : null,
  };
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

/**
 * Type B date ("11AUG") -> ISO date. No year is transmitted on the wire,
 * so the caller-supplied `referenceYear` (defaulting to the current UTC
 * year) resolves it — correct as long as the message is parsed within the
 * same year it was sent, true for all operational message traffic.
 */
function typeBDateToIso(typeBDate: string, referenceYear = new Date().getUTCFullYear()): string {
  const m = /^(\d{2})([A-Z]{3})$/.exec(typeBDate);
  if (!m) throw new Error(`invalid Type B date: ${typeBDate}`);
  const monthIndex = MONTHS.indexOf(m[2] as (typeof MONTHS)[number]);
  if (monthIndex < 0) throw new Error(`invalid Type B date: ${typeBDate}`);
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${referenceYear}-${month}-${m[1]}`;
}
