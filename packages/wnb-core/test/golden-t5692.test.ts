/**
 * Golden regression test — T5 692, docs/AHM560_GROUND_TRUTH.md §19.
 *
 * Split into two parts, because during Faz 3 development this test
 * surfaced a real discrepancy (documented in docs/AHM560_ERRATA.md
 * "Kayıt 6" and GROUND_TRUTH.md as Bulgu #7): running the T5 692 load
 * bottom-up through AHM 560 Ed.1/Rev.0's own position/fuel index tables
 * does NOT reproduce the real printed loadsheet's LIZFW (106.07) or fuel
 * index (3.32) — this engine computes ~104.97 and ~3.77 from the AHM data
 * we have. This is the same pattern as the already-documented Bulgu #2
 * (DOW/DOI mismatch): the AHM revision that actually produced
 * LS_T5692_11082026_ED01.pdf appears not to be Ed.1/Rev.0.
 *
 * Part 1 verifies what is 100% independently checkable and must match
 * exactly regardless of that discrepancy: pure weight arithmetic
 * (TTL/ZFW/TOW/LDW/TAXI WEIGHT) and the corrected underload (Bulgu #1).
 *
 * Part 2 verifies the %MAC/STAB *formula* is bit-exact against AHM 560's
 * documented methodology, by feeding it the loadsheet's own printed
 * LIZFW/LITOW as inputs (exactly reproducing GROUND_TRUTH.md §19.2's
 * worked calculation) — proving the formula implementation itself is
 * correct, independent of the AHM-data-revision question.
 *
 * Part 3 documents (and pins, so it can't silently drift) this engine's
 * own bottom-up result from AHM 560 Ed.1/Rev.0 data, and the size of its
 * divergence from the printed loadsheet.
 */

import { describe, expect, it } from "vitest";
import { calculateWnb } from "../src/wnb";
import { indexToMac, macToStab } from "../src/formula";
import {
  t5692ExpectedArithmetic,
  t5692Input,
  t5692PrintedLoadsheet,
} from "./fixtures/t5692";

describe("T5 692 — Part 1: pure arithmetic (must match exactly)", () => {
  const result = calculateWnb(t5692Input);

  it("TTL = 35278 (26929 main deck + 8349 lower deck)", () => {
    expect(result.ttl).toBe(t5692ExpectedArithmetic.ttl);
  });

  it("ZFW = DOW + TTL = 146321.7", () => {
    expect(result.zfw).toBe(t5692ExpectedArithmetic.zfw);
  });

  it("TOW = ZFW + takeoff fuel = 191021.7", () => {
    expect(result.tow).toBe(t5692ExpectedArithmetic.tow);
  });

  it("LDW = TOW - trip fuel = 154361.7", () => {
    expect(result.ldw).toBe(t5692ExpectedArithmetic.ldw);
  });

  it("TAXI WEIGHT = TOW + taxi fuel = 191621.7", () => {
    expect(result.taxiWeight).toBe(t5692ExpectedArithmetic.taxiWeight);
  });

  it("underload: corrects Aerometa's rounding bug (Bulgu #1)", () => {
    // The real loadsheet prints 24722 kg, derived from a DOW rounded to
    // 110000 kg. The correct value, from the exact DOW (111043.70), is
    // 23678.3 kg — 1043.7 kg less margin than Aerometa reports.
    expect(result.underloadBeforeLmc).toBe(t5692ExpectedArithmetic.underloadBeforeLmc);
    expect(result.underloadBeforeLmc).not.toBe("24722");
  });
});

describe("T5 692 — Part 2: %MAC/STAB formula, verified against GROUND_TRUTH.md §19.2's worked calculation", () => {
  it("MACZFW: indexToMac(106.07, 146321.7) truncates/rounds to 26.4", () => {
    const mac = indexToMac(t5692PrintedLoadsheet.lizfw, t5692ExpectedArithmetic.zfw, t5692Input.indexFormula);
    expect(mac.toDecimalPlaces(4).toString()).toBe("26.4265");
    expect(mac.toDecimalPlaces(1, 4).toString()).toBe(t5692PrintedLoadsheet.maczfw); // ROUND_HALF_UP
  });

  it("MACTOW: indexToMac(109.39, 191021.7) rounds to 26.7", () => {
    const mac = indexToMac(t5692PrintedLoadsheet.litow, t5692ExpectedArithmetic.tow, t5692Input.indexFormula);
    expect(mac.toDecimalPlaces(4).toString()).toBe("26.6904");
    expect(mac.toDecimalPlaces(1, 4).toString()).toBe(t5692PrintedLoadsheet.mactow); // ROUND_HALF_UP
  });

  it("STAB: macToStab(26.6904) truncates to 4.1 Up", () => {
    const { value, direction } = macToStab("26.6904", t5692Input.stabCurve, t5692Input.stabRounding);
    expect(value.toString()).toBe(t5692PrintedLoadsheet.stab);
    expect(direction).toBe("UP");
  });
});

describe("T5 692 — Part 3: this engine's own AHM 560 Ed.1/Rev.0-sourced result (documents the Bulgu #7 gap)", () => {
  const result = calculateWnb(t5692Input);

  it("computes LIZFW bottom-up from DOI + 33 position index contributions", () => {
    // DOI 78.22 + sum(weight_i * indexPerKg_i) over all 33 load items,
    // using AHM 560 Ed.1/Rev.0's own position index-per-kg table.
    expect(result.lizfw).toBe("104.97");
    const gap = Number(t5692PrintedLoadsheet.lizfw) - Number(result.lizfw);
    expect(gap).toBeCloseTo(1.10, 1);
  });

  it("computes the takeoff fuel index from AHM 560 Ed.1/Rev.0's own fuel table", () => {
    // getFuelIndex(44700, "0.785") interpolated between the 44000/46500 rows.
    expect(result.fuelIndex.takeoff).toBe("3.77");
    const gap = Number("3.32") - Number(result.fuelIndex.takeoff);
    expect(gap).toBeCloseTo(-0.45, 1);
  });

  it("MACZFW/MACTOW/STAB computed from this engine's own LIZFW/LITOW differ from the printed loadsheet", () => {
    // This is the expected, documented consequence of the LIZFW/fuel-index
    // gaps above — not a bug in the %MAC/STAB formula itself (see Part 2).
    expect(result.maczfw).not.toBe(t5692PrintedLoadsheet.maczfw);
    expect(result.mactow).not.toBe(t5692PrintedLoadsheet.mactow);
  });
});

describe("T5 692 — weight limit guards", () => {
  it("does not throw for the T5 692 load (well within MZFW/MTOW/MLW/MTW)", () => {
    expect(() => calculateWnb(t5692Input)).not.toThrow();
  });
});
