import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { calculateWnb, checkEnvelope } from "@tua/wnb-core";
import { computeLiveWnb, resolvePositions, type DraftLoadItem, type LoadPlanAhmData } from "../src/lib/load-plan-calc";

const ahm = loadAhmData("a330-243p2f", 1, 0);

const ahmData: LoadPlanAhmData = {
  ahmDocumentId: "test",
  weightLimits: ahm.aircraft.weightLimits,
  positions: ahm.positions.positions,
  compartments: ahm.compartments.compartments,
  mainDeckMaxLoad: ahm.compartments.mainDeckMaxLoad,
  longPalletDistribution: ahm.zoneMapping.longPalletDistribution,
  combinedLoadZones: ahm.combinedLoad.zones,
  cgLimits: ahm.cgLimits,
  fuelIndexTable: ahm.fuelIndex,
  indexFormula: {
    refSta: ahm.indexFormula.refSta,
    k: ahm.indexFormula.k,
    c: ahm.indexFormula.c,
    refStaMinusLemac: ahm.indexFormula.derived.refStaMinusLemac,
    macOver100: ahm.indexFormula.derived.macOver100,
  },
  stabCurve: ahm.indexFormula.stabTrimCurve,
  stabRounding: {
    method: ahm.indexFormula.roundingRules.stab.method,
    decimals: ahm.indexFormula.roundingRules.stab.decimals,
  },
  dowDoiMatrix: { "EZ-F429": ahm.dowDoiMatrix["EZ-F429"], "EZ-F430": ahm.dowDoiMatrix["EZ-F430"] },
  cockpitMaxSeats: ahm.crewIndex.cockpit.maxSeats,
  courierMaxSeats: ahm.crewIndex.courier.reduce((sum, c) => sum + c.maxSeats, 0),
};

// AHM 560's own dow-doi-matrix.json cell for EZ-F430, 2 cockpit + 3
// courier crew — matches GROUND_TRUTH.md Bulgu #2's "AHM tablosu 111720
// diyor" note, i.e. a real, exact matrix row (not the divergent printed
// loadsheet value).
const CREW = { cockpitCrew: 2, courierCrew: 3 };
const EXPECTED_DOW = "111720";
const EXPECTED_DOI = "77.74";

// T5 692's real 33-item load (GROUND_TRUTH.md §19.1) — a realistic full
// load, needed to land MACZFW inside the combined-load table's [21, 38)
// band range. Ambiguous lower-deck pallet codes get an explicit uldType
// (the 96x125 variant, matching GROUND_TRUTH.md §19.1's "Tip" column).
const items: DraftLoadItem[] = [
  { position: "ABL", weight: "717", awb: "06154" },
  { position: "ABR", weight: "834", awb: "06115" },
  { position: "BCL", weight: "915", awb: "06298" },
  { position: "BCR", weight: "919", awb: "06017" },
  { position: "CEL", weight: "925", awb: "06589" },
  { position: "CER", weight: "952", awb: "06586" },
  { position: "EFL", weight: "956", awb: "06743" },
  { position: "EFR", weight: "1019", awb: "06141" },
  { position: "FHL", weight: "1022", awb: "0029" },
  { position: "FHR", weight: "1029", awb: "06505" },
  { position: "HJL", weight: "1285", awb: "06507" },
  { position: "HJR", weight: "1104", awb: "06628" },
  { position: "JKL", weight: "1089", awb: "06683" },
  { position: "JKR", weight: "1094", awb: "06668" },
  { position: "KML", weight: "1068", awb: "06591" },
  { position: "KMR", weight: "1096", awb: "06273" },
  { position: "MPL", weight: "1575", awb: "06730" },
  { position: "MPR", weight: "1702", awb: "06102" },
  { position: "PP", weight: "2125", awb: "06014" },
  { position: "RR", weight: "1856", awb: "06332" },
  { position: "SS", weight: "1528", awb: "06243" },
  { position: "TT", weight: "2119", awb: "06064" },
  { position: "11", weight: "472", awb: "05185" },
  { position: "12P", weight: "800", awb: "06645", uldType: "PALLET_96x125" },
  { position: "13P", weight: "835", awb: "06672", uldType: "PALLET_96x125" },
  { position: "21P", weight: "846", awb: "06116", uldType: "PALLET_96x125" },
  { position: "22P", weight: "871", awb: "06094", uldType: "PALLET_96x125" },
  { position: "31P", weight: "876", awb: "06044", uldType: "PALLET_96x125" },
  { position: "32P", weight: "916", awb: "0002", uldType: "PALLET_96x125" },
  { position: "41P", weight: "1003", awb: "06530", uldType: "PALLET_96x125" },
  { position: "42P", weight: "1050", awb: "06284", uldType: "PALLET_96x125" },
  { position: "52", weight: "340" },
  { position: "53", weight: "340" },
];

const fuel = { density: "0.785", takeoffFuel: "44700", tripFuel: "36660", taxiFuel: "600" };

describe("resolvePositions", () => {
  it("resolves an ambiguous position code to the variant named by the draft item's uldType", () => {
    const resolved = resolvePositions(ahm.positions.positions, [
      { position: "12P", weight: "800", uldType: "PALLET_96x125" },
    ]);
    const pos = resolved.find((p) => p.code === "12P");
    expect(pos?.uldType).toBe("PALLET_96x125");
  });

  it("falls back to a stable default variant when no uldType is given", () => {
    const resolved = resolvePositions(ahm.positions.positions, [{ position: "12P", weight: "800" }]);
    expect(resolved.filter((p) => p.code === "12P")).toHaveLength(1);
  });

  it("never returns more than one entry per position code", () => {
    const resolved = resolvePositions(ahm.positions.positions, items);
    const codes = resolved.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("computeLiveWnb", () => {
  it("reports a graceful blockingError (never throws) when ZFW is below the CG table's minimum weight — e.g. no load entered yet", () => {
    expect(() => computeLiveWnb({ items: [], fuel, ...CREW }, ahmData, "EZ-F430")).not.toThrow();
    const result = computeLiveWnb({ items: [], fuel, ...CREW }, ahmData, "EZ-F430");
    expect(result.blockingError?.code).toBe("ENVELOPE_RANGE");
    expect(result.envelope).toBeNull();
    expect(result.allWithinEnvelope).toBe(false);
  });

  it("looks up DOW/DOI from the AHM matrix for the given crew combination", () => {
    const result = computeLiveWnb({ items, fuel, ...CREW }, ahmData, "EZ-F430");
    expect(result.dowDoi).toEqual({ available: true, dow: EXPECTED_DOW, doi: EXPECTED_DOI });
  });

  it("matches calling calculateWnb + checkEnvelope directly with the same resolved inputs", () => {
    const result = computeLiveWnb({ items, fuel, ...CREW }, ahmData, "EZ-F430");
    const positions = resolvePositions(ahm.positions.positions, items);

    const expectedWnb = calculateWnb({
      weightLimits: ahmData.weightLimits,
      dow: EXPECTED_DOW,
      doi: EXPECTED_DOI,
      loadItems: items,
      positions,
      fuel,
      fuelIndexTable: ahmData.fuelIndexTable,
      indexFormula: ahmData.indexFormula,
      stabCurve: ahmData.stabCurve,
      stabRounding: ahmData.stabRounding,
    });

    expect(result.wnb).toEqual(expectedWnb);

    const expectedZfwEnvelope = checkEnvelope(expectedWnb.zfw, expectedWnb.lizfw, "ZFW", ahmData.cgLimits.zfw);
    expect(result.envelope?.zfw).toEqual(expectedZfwEnvelope);
  });

  it("flags a position overload when an item's weight exceeds its position's maxGross", () => {
    const overloaded: DraftLoadItem[] = [{ position: "TT", weight: "999999" }];
    const result = computeLiveWnb({ items: overloaded, fuel, ...CREW }, ahmData, "EZ-F430");
    expect(result.positionOverloads).toEqual([{ position: "TT", actual: "999999", max: expect.any(String) }]);
  });

  it("reports crew as unavailable and skips DOW/DOI-dependent checks when crew isn't set", () => {
    const result = computeLiveWnb({ items, fuel, cockpitCrew: null, courierCrew: null }, ahmData, "EZ-F430");
    expect(result.dowDoi).toEqual({ available: false, reason: "crewNotSet" });
    expect(result.wnb).toBeNull();
    expect(result.allWithinEnvelope).toBe(false);
  });

  it("reports lateral imbalance as NOT_AVAILABLE (no AHM 560 s.74 data exists)", () => {
    const result = computeLiveWnb({ items, fuel, ...CREW }, ahmData, "EZ-F430");
    expect(result.lateralImbalance.status).toBe("NOT_AVAILABLE");
  });

  it("populates compartment and combined-load checks without throwing for a realistic load", () => {
    const result = computeLiveWnb({ items, fuel, ...CREW }, ahmData, "EZ-F430");
    expect(result.compartments.length).toBeGreaterThan(0);
    expect(result.combinedLoad.available).toBe(true);
  });
});
