import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { calculateWnb, calculatePositionIndexes, checkEnvelope, getDowDoi } from "../src";
import { loadAhmData } from "@tua/ahm-data";
import {
  t5477DowDoi,
  t5477Input,
  t5477LoadItems,
  t5477Positions,
  t5477PrintedLoadsheet as printed,
} from "./fixtures/t5477";

/**
 * T5 477 comparison — the second real Aerometa production loadsheet this
 * project can check itself against. See docs/T5477_REFERENCE_TRANSCRIPTION.md
 * for the transcription and its provenance.
 *
 * Structured the same way as golden-t5692.test.ts: fields that must match
 * exactly are asserted against the printed document, fields where we
 * deliberately differ are asserted against *our* value with the reason
 * pinned, and the open data question is pinned as a measured number rather
 * than hidden behind a tolerance.
 */

const wnb = calculateWnb(t5477Input);

describe("T5 477 — Part 1: arithmetic that must match the printed loadsheet", () => {
  it("totals the transcribed load to the printed TOTAL TRAFFIC LOAD", () => {
    const sum = t5477LoadItems.reduce((acc, i) => acc.plus(new Decimal(i.weight)), new Decimal(0));
    expect(sum.toString()).toBe(printed.ttl);
    expect(wnb.ttl).toBe(printed.ttl);
  });

  // Every weight below follows from DOW + TTL and the fuel figures, so each
  // sits exactly 0.3 kg above the printed value: the printed DOW carries a
  // fractional basic weight (111293.70) where the AHM crew table is printed
  // to whole kg (111294). Nothing else contributes.
  it("reproduces every weight to within the DOW table's whole-kg rounding", () => {
    const pairs: [string, string][] = [
      [wnb.zfw, printed.zfw],
      [wnb.tow, printed.tow],
      [wnb.ldw, printed.ldw],
      [wnb.taxiWeight, printed.taxiWeight],
    ];
    for (const [ours, theirs] of pairs) {
      expect(new Decimal(ours).minus(theirs).toNumber()).toBeCloseTo(0.3, 6);
    }
  });
});

describe("T5 477 — Part 2: AHM 560 Ed.1 Rev.2 confirmed on the second registration", () => {
  // T5 692 confirmed Rev.2 on EZ-F430. This confirms it independently on
  // EZ-F429, and closes GROUND_TRUTH.md Bulgu #2 for both airframes.
  it("predicts the printed DOW to 0.3 kg and DOI to 0.02 index units", () => {
    const ahm = loadAhmData("a330-243p2f", 1, 2);
    const cell = getDowDoi("EZ-F429", 2, 3, ahm.dowDoiMatrix["EZ-F429"]);
    expect(cell).toEqual(t5477DowDoi);

    expect(new Decimal(cell.dow).minus(printed.dow).abs().toNumber()).toBeLessThanOrEqual(0.3);
    expect(new Decimal(cell.doi).minus(printed.doi).abs().toNumber()).toBeLessThanOrEqual(0.02);
  });

  it("is far closer than Rev.0, which this flight would have put 266 kg out", () => {
    const rev0 = loadAhmData("a330-243p2f", 1, 0);
    const old = getDowDoi("EZ-F429", 2, 3, rev0.dowDoiMatrix["EZ-F429"]);
    expect(new Decimal(old.dow).minus(printed.dow).abs().toNumber()).toBeGreaterThan(200);
  });
});

describe("T5 477 — Part 3: Aerometa defects this flight exposes", () => {
  /**
   * GROUND_TRUTH.md Bulgu #1. The correct underload is the smallest of the
   * three margins; on this flight that is MLW, not MZFW:
   *
   *   MZFW 170000 - ZFW 155134.7 = 14865.3
   *   MTOW 233000 - TOW 216534.7 = 16465.3
   *   MLW  182000 - LDW 179562.7 =  2437.3  <- binding
   *
   * Aerometa printed 16159, which is 170000 - 110000 - 43841: MZFW against a
   * DOW rounded down to 110 000. It is not merely the wrong limit, it is the
   * wrong limit computed from a rounded weight, and it overstates the spare
   * capacity by 13 722 kg in the unsafe direction.
   */
  it("computes the underload from the binding limit, not a rounded MZFW", () => {
    expect(wnb.underloadBeforeLmc).toBe("2437");

    const overstatement = new Decimal(printed.underloadBeforeLmc).minus(wnb.underloadBeforeLmc);
    expect(overstatement.toNumber()).toBeGreaterThan(13000);
  });

  // GROUND_TRUTH.md Bulgu #5 — the loadsheet prints neither, AHM 560 s.13
  // marks both mandatory.
  it("produces LILAW and MACLAW, which the printed loadsheet omits", () => {
    expect(wnb.lilaw).toBeTruthy();
    expect(wnb.maclaw).toBeTruthy();
    expect(printed).not.toHaveProperty("lilaw");
    expect(printed).not.toHaveProperty("maclaw");
  });
});

describe("T5 477 — Part 4: the open index question, measured not hidden", () => {
  /**
   * AHM560_ERRATA.md Kayıt 6 / GROUND_TRUTH.md Bulgu #7. Computing the
   * deadload index bottom-up from positions.json does not reproduce the
   * printed LIZFW. These assertions pin the size of that gap so a future AHM
   * page changes the number visibly instead of silently.
   *
   * On T5 477 the DOI is now all but exact (0.02), so the whole residue is
   * in the position index table:
   *
   *   printed LIZFW 100.78 - printed DOI 76.31 = 24.47 deadload index
   *   ours          101.46 - ours DOI    76.29 = 25.17
   *
   * 0.70 index units over 43 841 kg. On T5 692 the same measurement gave
   * 1.10 over 35 278 kg, so the gap is not a fixed offset — it scales with
   * something in the load, consistent with a per-position index difference
   * rather than a constant.
   */
  it("pins the deadload index gap against the printed loadsheet", () => {
    const { totalIndex } = calculatePositionIndexes(t5477LoadItems, t5477Positions);
    expect(totalIndex).toBe("25.17");

    const printedDeadload = new Decimal(printed.lizfw).minus(printed.doi);
    expect(printedDeadload.toFixed(2)).toBe("24.47");
    expect(new Decimal(totalIndex).minus(printedDeadload).toNumber()).toBeCloseTo(0.7, 2);
  });

  it("pins our LIZFW/LITOW and the %MAC they produce", () => {
    expect(wnb.lizfw).toBe("101.46");
    expect(wnb.litow).toBe("100.38");
    expect(wnb.maczfw).toBe("25.3");
    expect(wnb.mactow).toBe("25.1");
    expect(wnb.stab.value).toBe("4.9");
  });

  // The fuel side is much closer here than on T5 692 (0.12 vs 0.45 index
  // units), which is evidence that the fuel table is less implicated in the
  // Bulgu #7 residue than the position table is.
  it("pins the fuel index gap, which is small on this flight", () => {
    const oursFuelIndex = new Decimal(wnb.litow).minus(wnb.lizfw);
    const printedFuelIndex = new Decimal(printed.litow).minus(printed.lizfw);
    expect(oursFuelIndex.minus(printedFuelIndex).abs().toNumber()).toBeLessThan(0.15);
  });
});

describe("T5 477 — Part 5: CG envelope", () => {
  const ahm = loadAhmData("a330-243p2f", 1, 2);

  it("places both ZFW and TOW inside the published envelope", () => {
    const zfw = checkEnvelope(wnb.zfw, wnb.lizfw, "ZFW", ahm.cgLimits.zfw);
    const tow = checkEnvelope(wnb.tow, wnb.litow, "TOW", ahm.cgLimits.takeoff);
    expect(zfw.withinEnvelope).toBe(true);
    expect(tow.withinEnvelope).toBe(true);
  });

  // GROUND_TRUTH.md Bulgu #4 — interpolated limits do not quite match the
  // printed ones. Pinned per side so a data fix shows up as a changed number.
  it("pins the interpolated limit differences against the printed ones", () => {
    const zfw = checkEnvelope(wnb.zfw, wnb.lizfw, "ZFW", ahm.cgLimits.zfw);
    const tow = checkEnvelope(wnb.tow, wnb.litow, "TOW", ahm.cgLimits.takeoff);

    expect(new Decimal(zfw.forwardLimit).minus(printed.zfwLimitFwd).toNumber()).toBeCloseTo(-0.86, 1);
    expect(new Decimal(zfw.aftLimit).minus(printed.zfwLimitAft).toNumber()).toBeCloseTo(0.3, 1);
    expect(new Decimal(tow.forwardLimit).minus(printed.towLimitFwd).toNumber()).toBeCloseTo(-0.74, 1);
    expect(new Decimal(tow.aftLimit).minus(printed.towLimitAft).toNumber()).toBeCloseTo(1.73, 1);
  });
});
