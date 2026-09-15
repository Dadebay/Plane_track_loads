/**
 * Four real operated flights, cross-checked against the operator's printed
 * loadsheets. See test/fixtures/reference-flights.ts for provenance.
 *
 * What this pins:
 *  1. the weight chain must reproduce the printed sheet exactly;
 *  2. UNDERLOAD must NOT reproduce it — Bulgu #1's rounded-DOW bug is present
 *     on all four sheets, and this test proves our value is the corrected one;
 *  3. the take-off fuel index must be read at take-off fuel, not ramp fuel —
 *     Bulgu #8. The printed sheets imply ramp fuel; we record that as a known,
 *     expected delta so it never gets "fixed" by matching Aerometa.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { calculateWnb } from "../src/index";
import { referenceFlights } from "./fixtures/reference-flights";

const MZFW = "170000";
/** The DOW Aerometa rounds to — GROUND_TRUTH.md §20 Bulgu #1. */
const AEROMETA_ROUNDED_DOW = "110000";

describe.each(referenceFlights)("$flight $date ($registration)", (f) => {
  const result = calculateWnb(f.input);

  it("reproduces the printed weight chain exactly", () => {
    expect({
      ttl: result.ttl,
      zfw: result.zfw,
      tow: result.tow,
      ldw: result.ldw,
      taxiWeight: result.taxiWeight,
    }).toEqual(f.printedWeights);
  });

  it("corrects the printed UNDERLOAD, which uses a rounded DOW", () => {
    // What the sheet printed is exactly MZFW - 110000 - TTL.
    const aerometa = new Decimal(MZFW).minus(AEROMETA_ROUNDED_DOW).minus(result.ttl);
    expect(aerometa.toString()).toBe(f.printedBalance.underloadBeforeLmc);

    // Ours uses the real DOW, so it is the smaller (safe) figure.
    expect(new Decimal(result.underloadBeforeLmc).lessThan(aerometa)).toBe(true);
  });

  it("reads the take-off fuel index at take-off fuel, not ramp fuel", () => {
    // The sheet's own LITOW - LIZFW is the fuel index it used.
    const printedFuelIndex = new Decimal(f.printedBalance.litow).minus(f.printedBalance.lizfw);
    const ours = new Decimal(result.fuelIndex.takeoff);

    // We are ~0.5 index units away, and always on the same side, because the
    // sheet included the 600 kg of taxi fuel that is burnt before take-off.
    const delta = ours.minus(printedFuelIndex);
    expect(delta.abs().greaterThan("0.4")).toBe(true);
    expect(delta.abs().lessThan("0.6")).toBe(true);
    expect(delta.isPositive()).toBe(true);
  });
});
