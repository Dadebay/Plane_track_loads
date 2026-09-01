/**
 * FBL — Freight Booked List.
 *
 * Pre-departure list of AWBs booked for a station's outbound flights —
 * distinct from FFM, which reports what was actually carried after
 * departure.
 */

import { toTypeBDate, toTypeBWeight } from "./format-utils";
import type { FblInput } from "./types";

export function encodeFbl(input: FblInput): string {
  const lines: string[] = [];

  lines.push("FBL");
  lines.push(input.station);

  for (const awb of input.awbs) {
    lines.push(
      `${awb.awb}/${awb.origin}${awb.destination}/${awb.pieces}/${toTypeBWeight(awb.weight)}/${awb.bookedForFlight}.${toTypeBDate(awb.bookedForDate)}`,
    );
  }

  return lines.join("\r\n");
}
