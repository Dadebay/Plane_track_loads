/**
 * FFM — Airline Flight Manifest.
 *
 * One line per AWB actually carried on the flight — the customs/handling
 * manifest, as opposed to FBL's pre-departure booking list.
 */

import { toTypeBDate, toTypeBWeight } from "./format-utils";
import type { FfmInput } from "./types";

export function encodeFfm(input: FfmInput): string {
  const { flight } = input;
  const lines: string[] = [];

  lines.push("FFM");
  lines.push(`${flight.flightNo}/${toTypeBDate(flight.date)}.${flight.origin}${flight.destination}`);

  for (const awb of input.awbs) {
    const desc = awb.contentDescription ? `/${awb.contentDescription.toUpperCase()}` : "";
    lines.push(`${awb.awb}/${awb.origin}${awb.destination}/${awb.pieces}/${toTypeBWeight(awb.weight)}${desc}`);
  }

  return lines.join("\r\n");
}
