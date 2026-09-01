import { describe, expect, it } from "vitest";
import { calculateWnb } from "../src/wnb";
import { checkCompartmentLimits } from "../src/compartment-limits";
import { WeightLimitExceededError } from "../src/errors";
import { t5692Input } from "./fixtures/t5692";
import type { Compartment, LoadItem, Position } from "../src/types";

function withLoad(weight: string) {
  return {
    ...t5692Input,
    loadItems: [{ position: "TT", weight }],
  };
}

describe("calculateWnb weight limit guards", () => {
  it("throws WeightLimitExceededError when ZFW exceeds MZFW (170000)", () => {
    // DOW 111043.70 + load must exceed 170000.
    expect(() => calculateWnb(withLoad("60000"))).toThrow(WeightLimitExceededError);
    try {
      calculateWnb(withLoad("60000"));
    } catch (e) {
      expect(e).toBeInstanceOf(WeightLimitExceededError);
      expect((e as WeightLimitExceededError).limitName).toBe("MZFW");
    }
  });

  it("throws WeightLimitExceededError when TOW exceeds MTOW (233000)", () => {
    // Keep ZFW under MZFW but push TOW over MTOW with a huge takeoff fuel load.
    const input = {
      ...t5692Input,
      loadItems: [{ position: "TT", weight: "1000" }] as LoadItem[],
      fuel: { ...t5692Input.fuel, takeoffFuel: "121957" }, // 111043.70+1000+121957 = 234000.7
    };
    expect(() => calculateWnb(input)).toThrow(WeightLimitExceededError);
  });

  it("does not throw for a normally-loaded flight", () => {
    expect(() => calculateWnb(t5692Input)).not.toThrow();
  });
});

describe("checkCompartmentLimits", () => {
  const positions: Position[] = [
    { code: "11", deck: "LOWER", uldType: "CONTAINER", maxGross: "3174", indexPerKg: "-0.00709" },
    { code: "21", deck: "LOWER", uldType: "CONTAINER", maxGross: "3174", indexPerKg: "-0.00441" },
    { code: "31", deck: "LOWER", uldType: "CONTAINER", maxGross: "3174", indexPerKg: "0.00178" },
    { code: "A", deck: "MAIN", uldType: "SINGLE_ROW_88x125", maxGross: "2826", indexPerKg: "-0.00696" },
  ];
  const compartments: Compartment[] = [
    { number: 1, description: "Forward cargo hold", maxGrossPair: "18869", pairedWith: 2, indexPerKg: "-0.00609", lirSubLimit: "12696" },
    { number: 2, description: "Forward cargo hold", maxGrossPair: "18869", pairedWith: 1, indexPerKg: "-0.00379", lirSubLimit: "10206" },
    { number: 3, description: "Aft cargo hold", maxGrossPair: "15241", pairedWith: 4, indexPerKg: "0.00243", lirSubLimit: "10206" },
    { number: 4, description: "Aft cargo hold", maxGrossPair: "15241", pairedWith: 3, indexPerKg: "0.00444", lirSubLimit: "10206" },
    { number: 5, description: "Rear (Bulk) cargo hold", maxGrossPair: "3468", pairedWith: null, indexPerKg: "0.00630", lirSubLimit: "3468" },
  ];

  it("reports within-limit for a light load", () => {
    const loadItems: LoadItem[] = [
      { position: "11", weight: "1000" },
      { position: "A", weight: "1000" },
    ];
    const checks = checkCompartmentLimits(loadItems, positions, compartments, "62000");
    const comp1 = checks.find((c) => c.target.startsWith("compartment 1"))!;
    expect(comp1.actual).toBe("1000");
    expect(comp1.withinLimit).toBe(true);
    const mainDeck = checks.find((c) => c.target === "main deck")!;
    expect(mainDeck.actual).toBe("1000");
    expect(mainDeck.withinLimit).toBe(true);
  });

  it("reports exceeded when a bay's LIR sub-limit is breached", () => {
    const loadItems: LoadItem[] = [{ position: "11", weight: "13000" }]; // > comp1's 12696
    const checks = checkCompartmentLimits(loadItems, positions, compartments, "62000");
    const comp1 = checks.find((c) => c.target.startsWith("compartment 1"))!;
    expect(comp1.withinLimit).toBe(false);
  });

  it("reports exceeded when the fwd (comp1+2) combined pair limit is breached", () => {
    const loadItems: LoadItem[] = [
      { position: "11", weight: "9500" },
      { position: "21", weight: "9500" },
    ]; // 19000 > 18869 combined, but each stays under its own 12696/10206 sub-limit
    const checks = checkCompartmentLimits(loadItems, positions, compartments, "62000");
    const pair = checks.find((c) => c.target === "compartments 1+2 combined")!;
    expect(pair.actual).toBe("19000");
    expect(pair.withinLimit).toBe(false);
  });

  it("reports exceeded when main deck total exceeds 62000", () => {
    const loadItems: LoadItem[] = [{ position: "A", weight: "2826" }];
    const checks = checkCompartmentLimits(loadItems, positions, compartments, "2000");
    const mainDeck = checks.find((c) => c.target === "main deck")!;
    expect(mainDeck.withinLimit).toBe(false);
  });
});
