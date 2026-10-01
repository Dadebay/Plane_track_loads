import { loadAhmData } from "@tua/ahm-data";
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateWnb, checkEnvelope } from "../src/index";
import { t5697Input, t5697PrintedLoadsheet as printed } from "./fixtures/t5697";

/**
 * T5 697 ASB-HAN, 2026-10-01 — the third real flight this engine is measured
 * against, and the first that lands above MZFW.
 *
 * Three groups, deliberately kept apart:
 *
 *   exact      — the figures that must match to the kilogram or the unit,
 *                including the three the crew actually fly on: MACZFW,
 *                MACTOW and the trim setting.
 *   explained  — differences with a known, documented cause. Each one is
 *                asserted at its measured size, so if the cause ever changes
 *                the test fails rather than quietly widening.
 *   defect     — where the printed sheet is wrong and this engine is right.
 *                Pinned so nobody "fixes" us towards it.
 */

const ahm = loadAhmData("a330-243p2f", 1, 2);
const wnb = calculateWnb(t5697Input);
const zfwEnvelope = checkEnvelope(wnb.zfw, wnb.lizfw, "ZFW", ahm.cgLimits.zfw);
const towEnvelope = checkEnvelope(wnb.tow, wnb.litow, "TOW", ahm.cgLimits.takeoff);

const diff = (ours: string, theirs: string) => new Decimal(ours).minus(new Decimal(theirs)).toNumber();

describe("T5 697 — exact agreement", () => {
  it("total traffic load", () => {
    expect(wnb.ttl).toBe(printed.ttl);
  });

  it("MACZFW, MACTOW and trim — the figures the crew fly on", () => {
    expect(Number(wnb.maczfw)).toBe(Number(printed.maczfw));
    expect(Number(wnb.mactow)).toBe(Number(printed.mactow));
    expect(wnb.stab.value).toBe(printed.stab);
    expect(wnb.stab.direction).toBe("UP");
  });
});

describe("T5 697 — explained differences", () => {
  it("every weight sits 0,3 kg high, because the crew table is printed to whole kg", () => {
    for (const [ours, theirs] of [
      [wnb.zfw, printed.zfw],
      [wnb.tow, printed.tow],
      [wnb.ldw, printed.ldw],
      [wnb.taxiWeight, printed.taxiWeight],
    ] as const) {
      expect(diff(ours, theirs)).toBeCloseTo(0.3, 6);
    }
  });

  it("DOI differs by the same table resolution", () => {
    expect(diff(wnb.doi, printed.doi)).toBeCloseTo(-0.02, 6);
  });

  it("the load index gap is small here and scales with load — AHM560_ERRATA Kayıt 6", () => {
    // 7 493 kg of payload: -0,12 at ZFW. T5 477 carried 43 841 kg and showed
    // 0,68; T5 692 carried 35 278 kg and showed 1,10. Not a constant offset —
    // which is why the position index table is where the question sits.
    expect(diff(wnb.lizfw, printed.lizfw)).toBeCloseTo(-0.12, 2);
    expect(diff(wnb.litow, printed.litow)).toBeCloseTo(0.23, 2);
  });

  it("CG limit interpolation differs as measured on the other two flights — Bulgu #4", () => {
    expect(diff(zfwEnvelope.forwardLimit, printed.zfwForwardLimit)).toBeCloseTo(-2.09, 1);
    expect(diff(zfwEnvelope.aftLimit, printed.zfwAftLimit)).toBeCloseTo(0.01, 1);
    expect(diff(towEnvelope.forwardLimit, printed.towForwardLimit)).toBeCloseTo(-0.62, 1);
    expect(diff(towEnvelope.aftLimit, printed.towAftLimit)).toBeCloseTo(1.76, 1);
  });
});

describe("T5 697 — where the printed sheet is wrong", () => {
  it("underload: the sheet claims 40 t of capacity the aircraft does not have", () => {
    // Ours is MLW-bound: 182 000 - 169 772.
    const mlwHeadroom = new Decimal(ahm.aircraft.weightLimits.mlw).minus(new Decimal(wnb.ldw));
    expect(new Decimal(wnb.underloadBeforeLmc).toNumber()).toBeCloseTo(mlwHeadroom.toNumber(), 1);

    // Theirs is MZFW against a DOW rounded down to 110 000, with no landing
    // or take-off constraint applied at all: 170 000 - (110 000 + 7 493).
    const roundedDow = new Decimal("110000").plus(new Decimal(printed.ttl));
    const theirs = new Decimal(ahm.aircraft.weightLimits.mzfw).minus(roundedDow);
    expect(theirs.toNumber()).toBeCloseTo(Number(printed.underloadBeforeLmc), 1);

    expect(diff(wnb.underloadBeforeLmc, printed.underloadBeforeLmc)).toBeLessThan(-40000);
  });

  it("lands 228 kg under MZFW — a few hundred kilos of fuel either way decides it", () => {
    // Worth pinning: this flight sits right on the edge that used to break
    // the calculation. The landing envelope borrowed the ZFW curve, which
    // ends at MZFW, so a slightly heavier landing — the same route with
    // more fuel aboard — was thrown out entirely. It lands *under* MZFW
    // here, which is why the printed sheet exists at all.
    const headroom = new Decimal(ahm.aircraft.weightLimits.mzfw).minus(new Decimal(wnb.ldw));
    expect(headroom.toNumber()).toBeCloseTo(228, 0);
    expect(Number(wnb.ldw)).toBeLessThanOrEqual(Number(ahm.aircraft.weightLimits.mlw));
    expect(zfwEnvelope.withinEnvelope).toBe(true);
    expect(towEnvelope.withinEnvelope).toBe(true);
  });

  it("produces LILAW and MACLAW, which the sheet omits — Bulgu #5", () => {
    expect(wnb.lilaw).toBeTruthy();
    expect(wnb.maclaw).toBeTruthy();
  });
});
