import { describe, expect, it } from "vitest";
import { formatIndex, formatWeight } from "../src/lib/format-number";

/**
 * CLAUDE.md's number format is locale-independent in all three UI
 * languages: thin space for thousands, comma for the decimal.
 */

const NBSP = " ";

describe("formatWeight", () => {
  it("groups thousands with a non-breaking space and uses a comma decimal", () => {
    expect(formatWeight("1234.5")).toBe(`1${NBSP}234,5`);
    expect(formatWeight("111293.70")).toBe(`111${NBSP}293,70`);
    expect(formatWeight("35328")).toBe(`35${NBSP}328`);
  });

  it("leaves a value under a thousand alone", () => {
    expect(formatWeight("340")).toBe("340");
    expect(formatWeight("0.5")).toBe("0,5");
  });

  it("preserves the trailing zeros the caller already decided on", () => {
    expect(formatWeight("146321.70")).toBe(`146${NBSP}321,70`);
  });

  it("keeps a negative sign", () => {
    expect(formatWeight("-1234.5")).toBe(`-1${NBSP}234,5`);
  });
});

describe("formatIndex", () => {
  it("always signs the value", () => {
    expect(formatIndex("26.46")).toBe("+26,46");
    expect(formatIndex("-5.65")).toBe("−5,65");
  });

  it("pads to exactly two decimals", () => {
    expect(formatIndex("26")).toBe("+26,00");
    expect(formatIndex("26.4")).toBe("+26,40");
  });

  it("rounds an interpolated CG envelope limit instead of printing the raw quotient", () => {
    // This is the bug this rounding exists for: checkEnvelope interpolates
    // between two published breakpoints and hands the UI the full quotient.
    expect(formatIndex("86.5239953703703703837")).toBe("+86,52");
    expect(formatIndex("154.5679398148148182")).toBe("+154,57");
    expect(formatIndex("70.34802212765957446")).toBe("+70,35");
    expect(formatIndex("168.3118129974811883")).toBe("+168,31");
  });

  it("prints a rounded-to-zero negative as a neutral +0,00", () => {
    // −0,00 would read like a real aft shift; it is not one.
    expect(formatIndex("-0.004")).toBe("+0,00");
    expect(formatIndex("0")).toBe("+0,00");
  });

  it("groups thousands in a large index the same way weights are grouped", () => {
    expect(formatIndex("1234.567")).toBe(`+1${NBSP}234,57`);
  });
});
