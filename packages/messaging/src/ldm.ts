/**
 * LDM — Load Message (AHM 583).
 *
 * Reports total traffic load and its distribution across main deck and
 * lower-deck compartments for a flight, sent to the next handling station
 * ahead of arrival. Compartment numbering (1-5, fwd-to-bulk) matches
 * @tua/wnb-core's checkCompartmentLimits grouping (packages/wnb-core/src/
 * compartment-limits.ts) — this encoder does not regroup positions itself,
 * it formats whatever compartment totals the caller already computed.
 */

import { Decimal } from "decimal.js";
import { toTypeBDate, toTypeBWeight, wrapTypeBText } from "./format-utils";
import type { LdmInput } from "./types";

export function encodeLdm(input: LdmInput): string {
  const { flight } = input;
  const lines: string[] = [];

  lines.push("LDM");

  const flightLine = `${flight.flightNo}${input.editionSuffix ?? ""}/${toTypeBDate(flight.date)}.${flight.origin}${flight.destination}`;
  lines.push(flightLine);

  const compartmentParts = input.compartments
    .filter((c) => !new Decimal(c.weight).isZero())
    .sort((a, b) => a.number - b.number)
    .map((c) => `COMPT ${c.number}/${toTypeBWeight(c.weight)}`);
  if (compartmentParts.length > 0) {
    lines.push(compartmentParts.join(" "));
  }

  lines.push(`MAINDECK/${toTypeBWeight(input.mainDeckWeight)}`);
  lines.push(`PAX/${input.passengers}`);
  lines.push(`TTL/${toTypeBWeight(input.totalTrafficLoad)}`);

  if (input.specialInformation) {
    lines.push(`SI`);
    lines.push(...wrapTypeBText(input.specialInformation));
  }

  return lines.join("\r\n");
}
