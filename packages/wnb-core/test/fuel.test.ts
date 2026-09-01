import { describe, expect, it } from "vitest";
import { getFuelIndex } from "../src/fuel";
import { FuelDensityOutOfRangeError, FuelWeightOutOfRangeError } from "../src/errors";
import type { FuelIndexTable } from "../src/types";

// AHM 560 s.17 (density 0.760, GROUND_TRUTH.md §8) plus a synthetic 0.790
// table so density-interpolation paths have two real tables to bracket.
const table: FuelIndexTable = {
  "0.760": [
    { fuelWeight: "2000", index: "-2.09" },
    { fuelWeight: "4000", index: "-4.25" },
    { fuelWeight: "44000", index: "+3.98" },
    { fuelWeight: "46500", index: "+2.27" },
    { fuelWeight: "FULL", index: "-8.98" },
  ],
  "0.790": [
    { fuelWeight: "2000", index: "-2.00" },
    { fuelWeight: "4000", index: "-4.00" },
    { fuelWeight: "44000", index: "+4.00" },
    { fuelWeight: "46500", index: "+2.00" },
    { fuelWeight: "FULL", index: "-9.00" },
  ],
};

describe("getFuelIndex", () => {
  it("returns the exact row value at a published fuel weight", () => {
    expect(getFuelIndex("2000", "0.760", table).toString()).toBe("-2.09");
  });

  it("linearly interpolates between two adjacent rows", () => {
    // Between 44000 (+3.98) and 46500 (+2.27): at 44700, t = 700/2500 = 0.28.
    // 3.98 + 0.28 * (2.27 - 3.98) = 3.5012
    const idx = getFuelIndex("44700", "0.760", table);
    expect(idx.toDecimalPlaces(4).toString()).toBe("3.5012");
  });

  it("does not require monotonic index values (dip-then-rise is normal — GROUND_TRUTH.md §8)", () => {
    const at2000 = getFuelIndex("2000", "0.760", table);
    const at4000 = getFuelIndex("4000", "0.760", table);
    expect(at4000.lt(at2000)).toBe(true); // index still going down here, that's fine
  });

  it("excludes the FULL row from weight interpolation and throws above the last numeric row", () => {
    expect(() => getFuelIndex("50000", "0.760", table)).toThrow(FuelWeightOutOfRangeError);
  });

  it("throws for a fuel weight below the table's minimum (no extrapolation)", () => {
    expect(() => getFuelIndex("1000", "0.760", table)).toThrow(FuelWeightOutOfRangeError);
  });

  it("throws for a density below the table range", () => {
    expect(() => getFuelIndex("2000", "0.700", table)).toThrow(FuelDensityOutOfRangeError);
  });

  it("throws for a density above the table range", () => {
    expect(() => getFuelIndex("2000", "0.900", table)).toThrow(FuelDensityOutOfRangeError);
  });

  it("performs a second interpolation between the two nearest tables for an off-table density (TODO — GROUND_TRUTH.md §21 Q1)", () => {
    // 0.775 is exactly midway between 0.760 and 0.790.
    const idx = getFuelIndex("2000", "0.775", table);
    // at 0.760: -2.09, at 0.790: -2.00 -> midpoint -2.045
    expect(idx.toDecimalPlaces(4).toString()).toBe("-2.045");
  });
});
