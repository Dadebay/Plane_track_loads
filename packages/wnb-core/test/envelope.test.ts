import { describe, expect, it } from "vitest";
import { checkEnvelope } from "../src/envelope";
import type { CgLimitCurve } from "../src/types";

// AHM 560 s.49 — ZFW limits (GROUND_TRUTH.md §10), used as a realistic curve.
const zfwCurve: CgLimitCurve = {
  forward: [
    { weight: "116000", index: "100.88" },
    { weight: "128960", index: "98.24" },
    { weight: "131759", index: "97.47" },
    { weight: "135440", index: "95.65" },
    { weight: "143000", index: "90.20" },
    { weight: "144080", index: "86.99" },
    { weight: "170000", index: "81.72" },
  ],
  aft: [
    { weight: "116000", index: "141.62" },
    { weight: "167840", index: "163.72" },
    { weight: "168920", index: "165.20" },
    { weight: "170000", index: "164.45" },
  ],
};

describe("checkEnvelope", () => {
  it("reports withinEnvelope: true for an index inside the interpolated limits", () => {
    // At ZFW 146321.7: FWD interpolates to ~86.53, AFT to ~154.55 (GROUND_TRUTH.md §19.3).
    const check = checkEnvelope("146321.7", "106.07", "ZFW", zfwCurve);
    expect(check.withinEnvelope).toBe(true);
    expect(Number(check.forwardLimit)).toBeCloseTo(86.53, 1);
    expect(Number(check.aftLimit)).toBeCloseTo(154.55, 1);
  });

  it("reports withinEnvelope: false when index is forward of the forward limit", () => {
    const check = checkEnvelope("146321.7", "50", "ZFW", zfwCurve);
    expect(check.withinEnvelope).toBe(false);
  });

  it("reports withinEnvelope: false when index is aft of the aft limit", () => {
    const check = checkEnvelope("146321.7", "200", "ZFW", zfwCurve);
    expect(check.withinEnvelope).toBe(false);
  });

  it("interpolates exactly at a published breakpoint", () => {
    const check = checkEnvelope("144080", "86.99", "ZFW", zfwCurve);
    expect(check.forwardLimit).toBe("86.99");
  });

  it("does not extrapolate below the table's minimum weight", () => {
    expect(() => checkEnvelope("100000", "90", "ZFW", zfwCurve)).toThrow(/outside the ZFW forward/);
  });

  it("does not extrapolate above the table's maximum weight", () => {
    expect(() => checkEnvelope("200000", "90", "ZFW", zfwCurve)).toThrow(/outside the ZFW forward/);
  });

  it("throws for an empty curve (no landing table published — GROUND_TRUTH.md §10)", () => {
    expect(() => checkEnvelope("150000", "100", "LDW", { forward: [], aft: [] })).toThrow(
      /no breakpoints/,
    );
  });
});
