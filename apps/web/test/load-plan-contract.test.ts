import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import {
  canEditLoadPlan,
  canFinalizeLoadPlan,
  checkCrewSet,
  checkFuelAllocation,
  checkFuelConsistency,
  checkPositionsExist,
  checkRefuelMode,
  checkUldEligibility,
  offloadLoadItemSchema,
  resolveGrossWeights,
  saveLoadPlanSchema,
  type FuelInput,
  type UldEligibility,
} from "../src/lib/load-plan-contract";
import type { LoadPlanAhmData } from "../src/lib/load-plan-calc";

/**
 * Faz 2 (T5 477 parity brief, Aşama 5) — the server contract.
 *
 * These are the gates a save has to pass. They run without Next.js because
 * the rules are pure functions over plain data; the action wires them up.
 */

const ahm = loadAhmData("a330-243p2f", 1, 2);
const ahmData = { positions: ahm.positions.positions } as unknown as LoadPlanAhmData;

const fuel = (overrides: Partial<FuelInput> = {}): FuelInput => ({
  density: "0.780",
  takeoffFuel: "61400",
  tripFuel: "36972",
  taxiFuel: "600",
  refuelMode: "MANUAL",
  allocations: [],
  ...overrides,
});

const uld = (overrides: Partial<UldEligibility> = {}): UldEligibility => ({
  id: "uld-1",
  code: "PMC12345TU",
  typeCode: "PMC",
  condition: "SERVICEABLE",
  status: "AVAILABLE",
  currentFlightId: null,
  ...overrides,
});

describe("roles", () => {
  it("lets a load controller and an admin write, and nobody else", () => {
    expect(canEditLoadPlan("LOAD_CONTROLLER")).toBe(true);
    expect(canEditLoadPlan("ADMIN")).toBe(true);
    expect(canEditLoadPlan("CHECKER")).toBe(false);
    expect(canEditLoadPlan("RAMP")).toBe(false);
    expect(canEditLoadPlan("VIEWER")).toBe(false);
  });

  it("gates finalization on the same set", () => {
    expect(canFinalizeLoadPlan("LOAD_CONTROLLER")).toBe(true);
    expect(canFinalizeLoadPlan("VIEWER")).toBe(false);
  });
});

describe("saveLoadPlanSchema", () => {
  const base = {
    legId: "leg-1",
    items: [{ position: "A", weight: "1000" }],
    fuel: { density: "0.780", takeoffFuel: "61400", tripFuel: "36972", taxiFuel: "600" },
    cockpitCrew: 2,
    courierCrew: 3,
    finalize: false,
  };

  it("defaults refuel mode to manual and the distribution to empty", () => {
    const parsed = saveLoadPlanSchema.parse(base);
    expect(parsed.fuel.refuelMode).toBe("MANUAL");
    expect(parsed.fuel.allocations).toEqual([]);
  });

  it("rejects a weight that is not a decimal string", () => {
    for (const weight of ["", "1,000", "-5", "abc", "1e3"]) {
      expect(saveLoadPlanSchema.safeParse({ ...base, items: [{ position: "A", weight }] }).success).toBe(false);
    }
  });

  it("rejects a crew count outside the published matrix", () => {
    expect(saveLoadPlanSchema.safeParse({ ...base, cockpitCrew: 0 }).success).toBe(false);
    expect(saveLoadPlanSchema.safeParse({ ...base, cockpitCrew: 5 }).success).toBe(false);
    expect(saveLoadPlanSchema.safeParse({ ...base, courierCrew: 7 }).success).toBe(false);
    expect(saveLoadPlanSchema.safeParse({ ...base, courierCrew: 0 }).success).toBe(true);
  });

  it("rejects an impossible tank and side combination at the schema edge", () => {
    const withTank = (tank: string, side: string) =>
      saveLoadPlanSchema.safeParse({
        ...base,
        fuel: { ...base.fuel, allocations: [{ tank, side, weight: "100" }] },
      }).success;
    expect(withTank("INNER", "LEFT")).toBe(true);
    expect(withTank("INNER", "UP")).toBe(false);
    expect(withTank("WING", "LEFT")).toBe(false);
  });

  it("requires an offload reason", () => {
    expect(offloadLoadItemSchema.safeParse({ loadItemId: "x", reason: "" }).success).toBe(false);
    expect(offloadLoadItemSchema.safeParse({ loadItemId: "x", reason: "not ready" }).success).toBe(true);
  });
});

describe("resolveGrossWeights", () => {
  it("passes gross through untouched when there is no breakdown", () => {
    const { violations, resolved } = resolveGrossWeights([{ position: "A", weight: "1000" }]);
    expect(violations).toEqual([]);
    expect(resolved[0]!.weight).toBe("1000");
  });

  it("accepts a gross that equals tare plus net", () => {
    const { violations } = resolveGrossWeights([
      { position: "A", weight: "1120", tareWeight: "120", netWeight: "1000" },
    ]);
    expect(violations).toEqual([]);
  });

  it("rejects a gross the client got wrong, and names the field", () => {
    const { violations, resolved } = resolveGrossWeights([
      { position: "A", weight: "1000" },
      { position: "B", weight: "9999", tareWeight: "120", netWeight: "1000" },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.code).toBe("grossNotTarePlusNet");
    expect(violations[0]!.field).toBe("items[1].weight");
    // The derived value wins regardless — the client's number never lands.
    expect(resolved[1]!.weight).toBe("1120");
  });

  it("is exact where a float sum would drift", () => {
    const { violations, resolved } = resolveGrossWeights([
      { position: "A", weight: "0.3", tareWeight: "0.1", netWeight: "0.2" },
    ]);
    expect(violations).toEqual([]);
    expect(resolved[0]!.weight).toBe("0.3");
  });
});

describe("checkPositionsExist", () => {
  it("accepts a published position", () => {
    expect(checkPositionsExist([{ position: "A", weight: "1000" }], ahmData)).toEqual([]);
  });

  it("rejects a position this revision does not publish", () => {
    const violations = checkPositionsExist([{ position: "ZZ", weight: "1000" }], ahmData);
    expect(violations[0]!.code).toBe("positionNotFound");
    expect(violations[0]!.field).toBe("items[0].position");
  });

  it("rejects a variant the position does not have", () => {
    const violations = checkPositionsExist(
      [{ position: "12P", weight: "1000", uldType: "SINGLE_ROW_88x125" }],
      ahmData,
    );
    expect(violations[0]!.code).toBe("positionVariantNotFound");
  });

  it("rejects an ambiguous position that names no variant", () => {
    // 12P exists as both PALLET_88x125 and PALLET_96x125 with different
    // maxGross and indexPerKg — the code alone is not enough to calculate.
    const violations = checkPositionsExist([{ position: "12P", weight: "1000" }], ahmData);
    expect(violations[0]!.code).toBe("positionVariantAmbiguous");
  });

  it("accepts a single-variant position with no uldType", () => {
    expect(checkPositionsExist([{ position: "AB", weight: "1000" }], ahmData)).toEqual([]);
  });
});

describe("checkUldEligibility", () => {
  const item = (uldId: string, position = "A") => ({ position, weight: "1000", uldId });

  it("ignores items that reference no inventory ULD", () => {
    expect(checkUldEligibility([{ position: "A", weight: "1000" }], [], "flight-1")).toEqual([]);
  });

  it("accepts a serviceable, free ULD", () => {
    expect(checkUldEligibility([item("uld-1")], [uld()], "flight-1")).toEqual([]);
  });

  it("accepts a ULD already held by this same flight", () => {
    expect(
      checkUldEligibility([item("uld-1")], [uld({ currentFlightId: "flight-1", status: "ASSIGNED" })], "flight-1"),
    ).toEqual([]);
  });

  it("rejects a ULD held by another flight", () => {
    const violations = checkUldEligibility([item("uld-1")], [uld({ currentFlightId: "other" })], "flight-1");
    expect(violations[0]!.code).toBe("uldHeldByAnotherFlight");
  });

  it("rejects a damaged or unserviceable ULD", () => {
    expect(checkUldEligibility([item("uld-1")], [uld({ condition: "DAMAGED" })], "flight-1")[0]!.code).toBe(
      "uldNotServiceable",
    );
    expect(checkUldEligibility([item("uld-1")], [uld({ condition: "UNSERVICEABLE" })], "flight-1")[0]!.code).toBe(
      "uldNotServiceable",
    );
  });

  it("rejects a lost ULD", () => {
    const violations = checkUldEligibility([item("uld-1")], [uld({ status: "LOST" })], "flight-1");
    expect(violations.some((v) => v.code === "uldLost")).toBe(true);
  });

  it("rejects an unknown ULD id", () => {
    expect(checkUldEligibility([item("ghost")], [uld()], "flight-1")[0]!.code).toBe("uldNotFound");
  });

  it("rejects the same ULD at two positions", () => {
    const violations = checkUldEligibility([item("uld-1", "A"), item("uld-1", "B")], [uld()], "flight-1");
    expect(violations[0]!.code).toBe("uldLoadedTwice");
    expect(violations[0]!.field).toBe("items[1].uldId");
  });
});

describe("fuel rules", () => {
  it("accepts an empty distribution — the controller has not split the fuel yet", () => {
    expect(checkFuelAllocation(fuel())).toEqual([]);
  });

  it("accepts a distribution that sums exactly to the takeoff fuel", () => {
    expect(
      checkFuelAllocation(
        fuel({
          allocations: [
            { tank: "INNER", side: "LEFT", weight: "20000" },
            { tank: "INNER", side: "RIGHT", weight: "20000" },
            { tank: "OUTER", side: "LEFT", weight: "2500" },
            { tank: "OUTER", side: "RIGHT", weight: "2500" },
            { tank: "CENTER", side: "CENTRE", weight: "15000" },
            { tank: "TRIM", side: "CENTRE", weight: "1400" },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a distribution that is one kilo short", () => {
    const violations = checkFuelAllocation(
      fuel({ allocations: [{ tank: "CENTER", side: "CENTRE", weight: "61399" }] }),
    );
    expect(violations[0]!.code).toBe("fuelAllocationInvalid");
    expect(violations[0]!.field).toBe("fuel.allocations");
  });

  it("refuses automatic refuelling, because the AHM publishes no schedule", () => {
    expect(checkRefuelMode(fuel())).toEqual([]);
    const violations = checkRefuelMode(fuel({ refuelMode: "AUTOMATIC" }));
    expect(violations[0]!.code).toBe("automaticRefuelUnavailable");
    expect(violations[0]!.field).toBe("fuel.refuelMode");
  });

  it("rejects trip fuel above takeoff fuel", () => {
    expect(checkFuelConsistency(fuel())).toEqual([]);
    const violations = checkFuelConsistency(fuel({ tripFuel: "70000" }));
    expect(violations[0]!.code).toBe("tripFuelAboveTakeoffFuel");
  });
});

describe("checkCrewSet", () => {
  it("accepts a crew version", () => {
    expect(checkCrewSet({ cockpitCrew: 2, courierCrew: 3 })).toEqual([]);
  });

  it("names each missing count separately", () => {
    const violations = checkCrewSet({ cockpitCrew: null, courierCrew: null });
    expect(violations.map((v) => v.code)).toEqual(["cockpitCrewNotSet", "courierCrewNotSet"]);
  });
});
