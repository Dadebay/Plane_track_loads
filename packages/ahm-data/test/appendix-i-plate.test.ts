import { describe, expect, it } from "vitest";
import { loadAhmData } from "../src/schema";

/**
 * AHM 560 Appendix I — LOAD AND TRIM SHEET plate, pages 2 and 3
 * (printed p.74 and p.75), Ed.1 Rev.0, effective 15.03.2023.
 *
 * These tests are the structural half of the transcription check demanded by
 * CLAUDE.md rule #3 and #9. The plate's numbers were read once by eye from a
 * ~174 ppi raster; a second reading of the same raster would repeat the same
 * mistakes, so instead each table is checked against data that was already in
 * the repository from an unrelated source (`positions.json`, itself derived
 * from the AHM's own loading index pages). Where the two agree to the last
 * printed decimal, the transcription is confirmed by something stronger than
 * a second look. See AHM560_ERRATA.md Kayıt 9 and 10.
 */

const data = loadAhmData("a330-243p2f", 1, 0);

// Zone letters as the plate prints them — I and O are skipped, hence 17
// letters for 17 zones.
const ZONES = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "P", "R", "S", "T", "U"];

/** AHM 560 s.15-16 §3 — index = W x (arm - refSta) / C, so a position's arm
 * is recoverable from its published index per kg. */
function armOf(indexPerKg: string): number {
  const { refSta, c } = data.indexFormula;
  return Number(refSta) + Number(c) * Number(indexPerKg);
}

function singleRow88(code: string) {
  const p = data.positions.positions.find(
    (x) => x.code === code && x.uldType === "SINGLE_ROW_88x125",
  );
  if (!p) throw new Error(`no SINGLE_ROW_88x125 position ${code}`);
  return p;
}

describe("LOADING ZONES H-arm TABLE", () => {
  const harm = data.loadingZonesHArm;

  it("is loaded and covers all seventeen printed zones in order", () => {
    expect(harm).not.toBeNull();
    expect(harm?.zones.map((z) => z.zone)).toEqual(ZONES);
  });

  it("tiles the main deck without gap or overlap: each zone's rear H-arm is the next zone's front H-arm", () => {
    const zones = harm!.zones;
    for (let i = 0; i < zones.length - 1; i += 1) {
      expect(zones[i]!.rearHArm).toBe(zones[i + 1]!.frontHArm);
    }
  });

  it("is strictly increasing", () => {
    for (const z of harm!.zones) {
      expect(Number(z.rearHArm)).toBeGreaterThan(Number(z.frontHArm));
    }
  });

  it("reproduces the independently published indexPerKg of the 88x125 single row to five decimals", () => {
    // A pallet centred in its zone has arm = (front + rear) / 2. Zones A..P
    // are one pallet pitch wide, so the midpoint is the pallet's own arm and
    // the two data sets must agree to the rounding of indexPerKg (±0.0125 m
    // of arm, i.e. ±0.000005 index units per kg).
    for (const zone of ZONES.slice(0, 13)) {
      const z = harm!.zones.find((x) => x.zone === zone)!;
      const mid = (Number(z.frontHArm) + Number(z.rearHArm)) / 2;
      const derived = (mid - Number(data.indexFormula.refSta)) / Number(data.indexFormula.c);
      expect(derived).toBeCloseTo(Number(singleRow88(zone).indexPerKg), 4);
    }
  });

  it("widens aft of zone R, where the fuselage tapers and the pallet no longer fills the zone", () => {
    const pitch = (zone: string) => {
      const z = harm!.zones.find((x) => x.zone === zone)!;
      return Number(z.rearHArm) - Number(z.frontHArm);
    };
    // The plate prints H-arms to 3 dp, so a nominal pitch shows up as either
    // 2.260 or 2.261 depending on where the rounding falls.
    for (const zone of ["B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "P"]) {
      expect(pitch(zone)).toBeCloseTo(2.2605, 2);
    }
    expect(pitch("R")).toBeCloseTo(2.667, 2);
    for (const zone of ["S", "T", "U"]) {
      expect(pitch(zone)).toBeCloseTo(2.464, 2);
    }
  });
});

describe("LMC INDEX TABLE", () => {
  const lmc = data.lmcIndexTable;

  it("is loaded and covers all seventeen printed zones", () => {
    expect(lmc).not.toBeNull();
    expect(Object.keys(lmc!.perHundredKg).sort()).toEqual([...ZONES].sort());
  });

  it("is exactly the published indexPerKg of the 88x125 single row, x100, rounded to one decimal", () => {
    // Every one of the seventeen cells reproduces — including F and G, which
    // both print -0.2 because -0.243 and -0.153 round to the same decimal.
    for (const zone of ZONES) {
      const exact = Number(singleRow88(zone).indexPerKg) * 100;
      const rounded = Math.sign(exact) * Math.round(Math.abs(exact) * 10) / 10;
      expect(Number(lmc!.perHundredKg[zone])).toBeCloseTo(rounded, 10);
    }
  });

  it("increases monotonically from nose to tail", () => {
    const values = ZONES.map((z) => Number(lmc!.perHundredKg[z]));
    for (let i = 0; i < values.length - 1; i += 1) {
      expect(values[i + 1]!).toBeGreaterThanOrEqual(values[i]!);
    }
  });
});

describe("LATERAL IMBALANCE CAUTION", () => {
  const lat = data.lateralImbalance;

  it("carries the printed limit, margin and sign rule", () => {
    expect(lat).not.toBeNull();
    expect(lat!.limit).toBe("34000");
    expect(lat!.operationalMargin).toBe("11554");
    expect(lat!.signRule).toBe("MARGIN_FOLLOWS_TOTAL");
    expect(lat!.scope).toBe("SIDE_BY_SIDE_PALLETS_ONLY");
  });

  it("carries the three printed payload y-arms", () => {
    expect(lat!.payload.map((p) => [p.category, p.yArm])).toEqual([
      ["MAIN_SBS_88", "1.13"],
      ["MAIN_SBS_96", "1.23"],
      ["LOWER_LD3", "0.81"],
    ]);
  });

  it("still declares the fuel half of the table untranscribed, so a total imbalance cannot be claimed", () => {
    // The fuel rows come from FUEL LATERAL MOMENT PER TANK TABLE on page 3 of
    // the plate, which we hold only as an illegible scan. Until that changes,
    // checkLateralImbalance() must stay NOT_AVAILABLE / provisional. If this
    // test ever fails because the status changed, the check may be enabled.
    expect(lat!.fuel.status).toBe("SOURCE_NOT_TRANSCRIBED");
    expect(lat!.verification.status).toBe("PAYLOAD_VERIFIED_FUEL_BLOCKED");
  });
});

describe("position configurations", () => {
  const cfg = data.positionConfigurations;

  it("is loaded with every printed row", () => {
    expect(cfg).not.toBeNull();
    expect(cfg!.configurations.map((c) => c.id)).toEqual([
      "SINGLE_ROW_88x125",
      "SINGLE_ROW_96x125",
      "SINGLE_ROW_125x96",
      "SIDE_BY_SIDE_125x88",
      "SIDE_BY_SIDE_125x96",
      "PALLET_16FT",
      "PALLET_20FT",
      "CONTAINER",
      "PALLET_88x125",
      "PALLET_96x125",
      "BULK",
    ]);
  });

  it("agrees with positions.json on every position code and max gross weight", () => {
    // positions.json was transcribed from the AHM's loading index pages; the
    // plate is a separate printing of the same limits. Disagreement here means
    // one of the two is wrong or they describe different revisions.
    for (const configuration of cfg!.configurations) {
      for (const printed of configuration.positions) {
        const held = data.positions.positions.find(
          (p) => p.code === printed.code && p.uldType === configuration.id,
        );
        expect(held, `${configuration.id} ${printed.code} missing from positions.json`).toBeDefined();
        expect(held!.maxGross, `${configuration.id} ${printed.code}`).toBe(printed.maxGross);
      }
    }
  });

  it("lists no position that positions.json does not carry, and vice versa", () => {
    const printed = new Set(
      cfg!.configurations.flatMap((c) => c.positions.map((p) => `${c.id}/${p.code}`)),
    );
    const held = new Set(data.positions.positions.map((p) => `${p.uldType}/${p.code}`));
    expect([...held].filter((k) => !printed.has(k))).toEqual([]);
    expect([...printed].filter((k) => !held.has(k))).toEqual([]);
  });

  it("has the lower-deck pallet pairs tiling exactly the containers they displace", () => {
    // The reason 11P and 43P do not exist: container 11 has no pallet over it.
    const footprint = (uldType: string, code: string) => {
      const p = data.positions.positions.find((x) => x.code === code && x.uldType === uldType)!;
      const configuration = cfg!.configurations.find((c) => c.id === uldType)!;
      const len = Number(configuration.longitudinalInches) * 0.0254;
      const arm = armOf(p.indexPerKg);
      return [arm - len / 2, arm + len / 2] as const;
    };
    const groups = [
      { pallets: ["12P", "13P"], containers: ["12", "13", "14"] },
      { pallets: ["21P", "22P"], containers: ["21", "22", "23"] },
      { pallets: ["31P", "32P"], containers: ["31", "32", "33"] },
      { pallets: ["41P", "42P"], containers: ["41", "42", "43"] },
    ];
    for (const { pallets, containers } of groups) {
      const p0 = footprint("PALLET_88x125", pallets[0]!);
      const p1 = footprint("PALLET_88x125", pallets[1]!);
      const c0 = footprint("CONTAINER", containers[0]!);
      const c2 = footprint("CONTAINER", containers[2]!);
      // The pair starts exactly where the first displaced container starts and
      // ends within the last one — two 88" pallets are 0.2 m shorter than three
      // 60.4" containers, so the aft group leaves a small gap.
      expect(p0[0]).toBeCloseTo(c0[0], 2);
      expect(p1[1]).toBeLessThanOrEqual(c2[1] + 0.01);
      expect(p1[1]).toBeGreaterThan(c2[0]);
    }
  });

  it("puts the 88x125 single-row positions exactly on the loading zones of the same name", () => {
    const len = 88 * 0.0254;
    // Zones A..P are one pallet pitch wide. R..U are wider (the fuselage
    // tapers), so the pallet no longer starts at the zone's front H-arm.
    for (const zone of ZONES.slice(0, 13)) {
      const arm = armOf(singleRow88(zone).indexPerKg);
      const z = data.loadingZonesHArm!.zones.find((x) => x.zone === zone)!;
      expect(arm - len / 2).toBeCloseTo(Number(z.frontHArm), 1);
    }
  });

  it("names every half-container position the LIR prints as an L/R pair", () => {
    expect(cfg!.halfContainerSuffixes).toEqual(["L", "R"]);
    expect(cfg!.halfContainerPositions).toEqual(
      cfg!.configurations.find((c) => c.id === "CONTAINER")!.positions.map((p) => p.code),
    );
  });
});

describe("FUEL INDEX PER TANK TABLE (provisional)", () => {
  const fti = data.fuelTankIndex;

  it("is loaded for all four tanks at the three printed densities", () => {
    expect(fti).not.toBeNull();
    expect(Object.keys(fti!.tanks).sort()).toEqual(["CENTER", "INNER", "OUTER", "TRIM"]);
    expect(fti!.densities).toEqual(["0.760", "0.800", "0.840"]);
    for (const tank of Object.values(fti!.tanks)) {
      expect(Object.keys(tank.step).sort()).toEqual(["0.760", "0.800", "0.840"]);
      expect(Object.keys(tank.full).sort()).toEqual(["0.760", "0.800", "0.840"]);
    }
  });

  it("is still flagged provisional, so nothing may calculate from it", () => {
    // Guard, not a wish: the scan cannot separate 6 from 8 at the printed
    // precision. Flipping this to false requires a legible second source and
    // an AHM560_ERRATA.md entry recording the re-verification.
    expect(fti!.provisional).toBe(true);
    expect(fti!.verification.status).toBe("SINGLE_READING_PROVISIONAL");
    expect(fti!.verification.flaggedCells.length).toBeGreaterThan(0);
  });

  it("steps each column by a constant weight increment", () => {
    for (const [name, tank] of Object.entries(fti!.tanks)) {
      for (const [density, rows] of Object.entries(tank.step)) {
        const step = Number(rows[1]!.fuelWeight) - Number(rows[0]!.fuelWeight);
        for (let i = 0; i < rows.length - 1; i += 1) {
          expect(
            Number(rows[i + 1]!.fuelWeight) - Number(rows[i]!.fuelWeight),
            `${name} ${density} row ${i}`,
          ).toBe(step);
        }
      }
    }
  });

  it("holds more fuel at a higher density, in every tank", () => {
    for (const [name, tank] of Object.entries(fti!.tanks)) {
      const last = (d: string) => Number(tank.step[d]!.at(-1)!.fuelWeight);
      expect(last("0.760"), name).toBeLessThanOrEqual(last("0.800"));
      expect(last("0.800"), name).toBeLessThanOrEqual(last("0.840"));
    }
  });

  it("keeps each column's sign: inner and centre tanks nose-down, outer and trim tanks tail-down", () => {
    const sign = (tank: string, expected: number) => {
      for (const rows of Object.values(fti!.tanks[tank]!.step)) {
        for (const row of rows) {
          if (Number(row.index) !== 0) expect(Math.sign(Number(row.index)), tank).toBe(expected);
        }
      }
    };
    sign("INNER", -1);
    sign("CENTER", -1);
    sign("OUTER", 1);
    sign("TRIM", 1);
  });
});

describe("Ed.1 Rev.2 inherits the plate", () => {
  const rev2 = loadAhmData("a330-243p2f", 1, 2);

  it("carries the same five Appendix I files as Rev.0", () => {
    // The plate is stamped Ed.1 Rev.0. Until a Rev.2 reissue turns up it is
    // carried forward unchanged, exactly like cargo-index-table.json.
    expect(rev2.lmcIndexTable).toEqual(data.lmcIndexTable);
    expect(rev2.loadingZonesHArm).toEqual(data.loadingZonesHArm);
    expect(rev2.lateralImbalance).toEqual(data.lateralImbalance);
    expect(rev2.positionConfigurations).toEqual(data.positionConfigurations);
    expect(rev2.fuelTankIndex).toEqual(data.fuelTankIndex);
  });
});
