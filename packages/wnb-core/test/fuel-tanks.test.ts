import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import {
  allocateFuelAutomatically,
  getTankAllocationIndex,
  getTankFuelIndex,
  ProvisionalAhmDataError,
  validateTankAllocation,
} from "../src/fuel-tanks";
import type { FuelTankIndexTable, TankAllocation } from "../src/types";

/** AHM 560 Appendix I s.75 — FUEL INDEX PER TANK TABLE. */

const ahm = loadAhmData("a330-243p2f", 1, 2);
const realTable = ahm.fuelTankIndex! as unknown as FuelTankIndexTable;

/** A small hand-built table, marked verified, so the interpolation itself can
 * be exercised while the real one is still blocked. Its numbers are invented
 * for the test and never leave it. */
const verifiedTable: FuelTankIndexTable = {
  provisional: false,
  tanks: {
    INNER: {
      perTank: true,
      step: {
        "0.800": [
          { fuelWeight: "1000", index: "-1" },
          { fuelWeight: "2000", index: "-2" },
          { fuelWeight: "3000", index: "-4" },
        ],
      },
      full: { "0.800": "-5" },
    },
    OUTER: {
      perTank: true,
      step: { "0.800": [{ fuelWeight: "500", index: "+1" }, { fuelWeight: "1000", index: "+2" }] },
      full: { "0.800": "+3" },
    },
  },
};

const balanced: TankAllocation[] = [
  { tank: "INNER", side: "LEFT", weight: "20000" },
  { tank: "INNER", side: "RIGHT", weight: "20000" },
  { tank: "OUTER", side: "LEFT", weight: "2500" },
  { tank: "OUTER", side: "RIGHT", weight: "2500" },
  { tank: "CENTER", side: "CENTRE", weight: "15000" },
  { tank: "TRIM", side: "CENTRE", weight: "1400" },
];

describe("validateTankAllocation", () => {
  it("accepts an allocation that sums exactly to the fuel total", () => {
    const check = validateTankAllocation(balanced, "61400");
    expect(check.balanced).toBe(true);
    expect(check.errors).toEqual([]);
    expect(check.allocated).toBe("61400");
    expect(check.difference).toBe("0");
  });

  it("rejects a near-miss: these are Decimal strings, so there is no rounding to absorb", () => {
    const check = validateTankAllocation(balanced, "61400.1");
    expect(check.balanced).toBe(false);
    expect(check.difference).toBe("-0.1");
    expect(check.errors.join(" ")).toContain("fuel total");
  });

  it("stays exact at a scale that would drift in floating point", () => {
    const check = validateTankAllocation(
      [
        { tank: "INNER", side: "LEFT", weight: "0.1" },
        { tank: "INNER", side: "RIGHT", weight: "0.2" },
      ],
      "0.3",
    );
    expect(check.balanced).toBe(true);
    expect(check.difference).toBe("0");
  });

  it("reports the running difference instead of throwing, so a half-typed form still renders", () => {
    const check = validateTankAllocation([{ tank: "CENTER", side: "CENTRE", weight: "1000" }], "61400");
    expect(check.balanced).toBe(false);
    expect(check.difference).toBe("-60400");
  });

  it("rejects a negative tank weight", () => {
    const check = validateTankAllocation(
      [
        { tank: "INNER", side: "LEFT", weight: "-100" },
        { tank: "INNER", side: "RIGHT", weight: "1100" },
      ],
      "1000",
    );
    expect(check.balanced).toBe(false);
    expect(check.errors.join(" ")).toContain("negative");
  });

  it("rejects a negative fuel total", () => {
    expect(validateTankAllocation([], "-1").errors.join(" ")).toContain("negative");
  });

  it("rejects the same tank twice", () => {
    const check = validateTankAllocation(
      [
        { tank: "CENTER", side: "CENTRE", weight: "500" },
        { tank: "CENTER", side: "CENTRE", weight: "500" },
      ],
      "1000",
    );
    expect(check.errors.join(" ")).toContain("more than once");
  });

  it("rejects a side on a centreline tank and a missing side on a paired tank", () => {
    expect(
      validateTankAllocation([{ tank: "TRIM", side: "LEFT", weight: "100" }], "100").errors.join(" "),
    ).toContain("no LEFT side");
    expect(
      validateTankAllocation([{ tank: "INNER", side: "CENTRE", weight: "100" }], "100").errors.join(" "),
    ).toContain("needs a side");
  });

  it("reports left-minus-right asymmetry per paired tank without failing the allocation", () => {
    const check = validateTankAllocation(
      [
        { tank: "INNER", side: "LEFT", weight: "600" },
        { tank: "INNER", side: "RIGHT", weight: "400" },
      ],
      "1000",
    );
    expect(check.balanced).toBe(true);
    expect(check.asymmetry).toEqual([{ tank: "INNER", difference: "200" }]);
  });

  it("checks a capacity only when one is supplied", () => {
    const allocation: TankAllocation[] = [{ tank: "CENTER", side: "CENTRE", weight: "40000" }];
    expect(validateTankAllocation(allocation, "40000").balanced).toBe(true);
    const capped = validateTankAllocation(allocation, "40000", [
      { tank: "CENTER", side: "CENTRE", capacity: "33000" },
    ]);
    expect(capped.balanced).toBe(false);
    expect(capped.errors.join(" ")).toContain("above its capacity");
  });
});

describe("allocateFuelAutomatically", () => {
  it("reports why it cannot run rather than inventing a fill order", () => {
    const result = allocateFuelAutomatically("61400", "0.780");
    expect(result.available).toBe(false);
    if (result.available) throw new Error("unreachable");
    expect(result.reason).toContain("publishes no automatic fuel distribution schedule");
  });
});

describe("getTankFuelIndex", () => {
  it("refuses the real table while it is flagged provisional", () => {
    // The guard the brief demands: an unverified constant must not reach a
    // result. Clearing this requires closing AHM560_ERRATA.md Kayıt 10.
    expect(realTable.provisional).toBe(true);
    expect(() => getTankFuelIndex("INNER", "20000", "0.800", realTable)).toThrow(ProvisionalAhmDataError);
    expect(() => getTankFuelIndex("INNER", "20000", "0.800", realTable)).toThrow(/Kayıt 10/);
  });

  it("returns a printed row exactly", () => {
    expect(getTankFuelIndex("INNER", "2000", "0.800", verifiedTable).toString()).toBe("-2");
  });

  it("interpolates linearly between two printed rows", () => {
    expect(getTankFuelIndex("INNER", "2500", "0.800", verifiedTable).toString()).toBe("-3");
  });

  it("treats an empty tank as no contribution", () => {
    expect(getTankFuelIndex("INNER", "0", "0.800", verifiedTable).toString()).toBe("0");
  });

  it("interpolates from zero up to the first printed row", () => {
    expect(getTankFuelIndex("INNER", "500", "0.800", verifiedTable).toString()).toBe("-0.5");
  });

  it("returns the printed FULL value above the last row rather than extrapolating", () => {
    expect(getTankFuelIndex("INNER", "3500", "0.800", verifiedTable).toString()).toBe("-5");
    expect(getTankFuelIndex("INNER", "999999", "0.800", verifiedTable).toString()).toBe("-5");
  });

  it("rejects an unknown tank or density", () => {
    expect(() => getTankFuelIndex("CENTER", "1000", "0.800", verifiedTable)).toThrow(/no CENTER column/);
    expect(() => getTankFuelIndex("INNER", "1000", "0.760", verifiedTable)).toThrow(/density 0.760/);
  });

  it("sums per-tank contributions across an allocation", () => {
    const index = getTankAllocationIndex(
      [
        { tank: "INNER", side: "LEFT", weight: "2000" },
        { tank: "INNER", side: "RIGHT", weight: "2000" },
        { tank: "OUTER", side: "LEFT", weight: "1000" },
        { tank: "OUTER", side: "RIGHT", weight: "1000" },
      ],
      "0.800",
      verifiedTable,
    );
    // The plate's footnote 1: INNER and OUTER are printed per tank, so each
    // side counts separately. -2 -2 +2 +2.
    expect(index.toString()).toBe("0");
  });
});
