/**
 * MVT — Movement Message (AHM 011/780).
 *
 * Reports a single actual movement event (off-block/airborne departure,
 * or touchdown/on-block arrival) for a flight, with the actual UTC time
 * and, where known, traffic figures at that event.
 */

import { toTypeBDate, toTypeBTime, toTypeBWeight, wrapTypeBText } from "./format-utils";
import type { MvtInput } from "./types";

export function encodeMvt(input: MvtInput): string {
  const { flight } = input;
  const lines: string[] = [];

  lines.push("MVT");
  lines.push(`${flight.flightNo}/${toTypeBDate(flight.date)}.${flight.origin}${flight.destination}`);
  lines.push(`${input.event}/${toTypeBTime(input.actualTime)}`);

  if (input.paxOnBoard !== undefined) {
    lines.push(`PAX/${input.paxOnBoard}`);
  }
  if (input.totalTrafficLoad !== undefined) {
    lines.push(`TTL/${toTypeBWeight(input.totalTrafficLoad)}`);
  }
  if (input.specialInformation) {
    lines.push("SI");
    lines.push(...wrapTypeBText(input.specialInformation));
  }

  return lines.join("\r\n");
}
