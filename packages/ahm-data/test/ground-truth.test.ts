/**
 * Ground-truth regression test — Faz 2.
 *
 * Asserts every numerical value documented in docs/AHM560_GROUND_TRUTH.md
 * against the extracted+loaded JSON data. If the extraction disagrees with
 * this file, the extraction is wrong (CLAUDE.md rule #9) — this test never
 * gets "fixed" to match a wrong extraction; the data or the extractor does.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { loadAhmData, type AhmDataSet } from "../src/index";

let data: AhmDataSet;

beforeAll(() => {
  data = loadAhmData("a330-243p2f", 1, 0);
});

function findPosition(code: string, uldType?: string) {
  const matches = data.positions.positions.filter(
    (p) => p.code === code && (uldType === undefined || p.uldType === uldType),
  );
  if (matches.length === 0) {
    throw new Error(`position ${code}${uldType ? ` (${uldType})` : ""} not found`);
  }
  return matches[0]!;
}

function findZone(zone: string) {
  const z = data.combinedLoad.zones.find((zz) => zz.zone === zone);
  if (!z) throw new Error(`zone ${zone} not found`);
  return z;
}

function fuelRow(density: string, fuelWeight: string) {
  const rows = data.fuelIndex[density];
  if (!rows) throw new Error(`density ${density} not found`);
  const row = rows.find((r) => r.fuelWeight === fuelWeight);
  if (!row) throw new Error(`fuel weight ${fuelWeight} not found in density ${density}`);
  return row;
}

// ---------------------------------------------------------------------------
// §1 Weight limits (AHM 560 s.3, s.48)
// ---------------------------------------------------------------------------
describe("§1 weight limits", () => {
  it("matches MTW/MTOW/MLW/MZFW/MIN", () => {
    expect(data.aircraft.weightLimits.mtw).toBe("233900");
    expect(data.aircraft.weightLimits.mtow).toBe("233000");
    expect(data.aircraft.weightLimits.mlw).toBe("182000");
    expect(data.aircraft.weightLimits.mzfw).toBe("170000");
    expect(data.aircraft.weightLimits.min).toBe("116000");
  });

  it("is identical for both registrations", () => {
    for (const reg of data.aircraft.registrations) {
      expect(reg.rampTaxi).toBe("233900");
      expect(reg.designTakeoffDry).toBe("233000");
      expect(reg.zeroFuel).toBe("170000");
      expect(reg.landing).toBe("182000");
    }
  });
});

// ---------------------------------------------------------------------------
// §2 Basic Empty Weight (AHM 560 s.4)
// ---------------------------------------------------------------------------
describe("§2 basic empty weight", () => {
  it("EZ-F429: BEW 111072.5, CG 19.64, index 82.65", () => {
    const r = data.aircraft.registrations.find((x) => x.registration === "EZ-F429")!;
    expect(r.bew).toBe("111072.5");
    expect(r.bewCgMac).toBe("19.64");
    expect(r.bewIndex).toBe("82.65");
  });

  it("EZ-F430: BEW 111233.5, CG 19.49, index 82.15", () => {
    const r = data.aircraft.registrations.find((x) => x.registration === "EZ-F430")!;
    expect(r.bew).toBe("111233.5");
    expect(r.bewCgMac).toBe("19.49");
    expect(r.bewIndex).toBe("82.15");
  });
});

// ---------------------------------------------------------------------------
// §4 DOW/DOI crew combination matrix (AHM 560 s.6) — 56 cells total
// ---------------------------------------------------------------------------
describe("§4 DOW/DOI crew combination matrix", () => {
  it("has 28 cells per registration, 56 total", () => {
    expect(data.dowDoiMatrix["EZ-F429"].length).toBe(28);
    expect(data.dowDoiMatrix["EZ-F430"].length).toBe(28);
  });

  function cell(reg: "EZ-F429" | "EZ-F430", cockpit: number, courier: number) {
    const c = data.dowDoiMatrix[reg].find(
      (x) => x.cockpitCrew === cockpit && x.courierCrew === courier,
    );
    if (!c) throw new Error(`cell not found: ${reg} cockpit=${cockpit} courier=${courier}`);
    return c;
  }

  it("EZ-F429 full matrix matches AHM 560 s.6", () => {
    const expected: Record<number, [string, string][]> = {
      1: [
        ["111220", "81.25"], ["111300", "80.56"], ["111380", "79.87"], ["111460", "79.18"],
        ["111540", "78.49"], ["111620", "77.80"], ["111700", "77.11"],
      ],
      2: [
        ["111320", "80.28"], ["111400", "79.59"], ["111480", "78.90"], ["111560", "78.21"],
        ["111640", "77.52"], ["111720", "76.83"], ["111800", "76.14"],
      ],
      3: [
        ["111420", "79.34"], ["111500", "78.65"], ["111580", "77.96"], ["111660", "77.28"],
        ["111740", "76.59"], ["111820", "75.90"], ["111900", "75.21"],
      ],
      4: [
        ["111520", "78.41"], ["111600", "77.72"], ["111680", "77.03"], ["111760", "76.34"],
        ["111840", "75.65"], ["111920", "74.96"], ["112000", "74.27"],
      ],
    };
    for (const cockpit of [1, 2, 3, 4]) {
      for (let courier = 0; courier <= 6; courier++) {
        const [dow, doi] = expected[cockpit]![courier]!;
        const c = cell("EZ-F429", cockpit, courier);
        expect(c.dow, `EZ-F429 cockpit${cockpit}/courier${courier} DOW`).toBe(dow);
        expect(c.doi, `EZ-F429 cockpit${cockpit}/courier${courier} DOI`).toBe(doi);
      }
    }
  });

  it("EZ-F430 full matrix matches AHM 560 s.6", () => {
    const expected: Record<number, [string, string][]> = {
      1: [
        ["111380", "80.78"], ["111460", "80.09"], ["111540", "79.40"], ["111620", "78.71"],
        ["111700", "78.02"], ["111780", "77.30"], ["111860", "76.64"],
      ],
      2: [
        ["111480", "79.81"], ["111560", "79.12"], ["111640", "78.43"], ["111720", "77.74"],
        ["111800", "77.05"], ["111880", "76.36"], ["111960", "75.67"],
      ],
      3: [
        ["111580", "78.87"], ["111660", "78.18"], ["111740", "77.49"], ["111820", "76.80"],
        ["111900", "76.11"], ["111980", "75.42"], ["112060", "74.73"],
      ],
      4: [
        ["111680", "77.94"], ["111760", "77.25"], ["111840", "76.56"], ["111920", "75.87"],
        ["112000", "75.18"], ["112080", "74.49"], ["112160", "73.80"],
      ],
    };
    for (const cockpit of [1, 2, 3, 4]) {
      for (let courier = 0; courier <= 6; courier++) {
        const [dow, doi] = expected[cockpit]![courier]!;
        const c = cell("EZ-F430", cockpit, courier);
        expect(c.dow, `EZ-F430 cockpit${cockpit}/courier${courier} DOW`).toBe(dow);
        expect(c.doi, `EZ-F430 cockpit${cockpit}/courier${courier} DOI`).toBe(doi);
      }
    }
  });

  it("EZ-F430 cockpit3/courier3 cell is normalized to two decimals (76.80), source printed 76,8", () => {
    expect(cell("EZ-F430", 3, 3).doi).toBe("76.80");
  });

  it("standard crew 2/3 DOW/DOI matches §3 standalone table", () => {
    // AHM 560 s.5 standalone table gives the same 2/3 values as the matrix.
    expect(cell("EZ-F429", 2, 3).dow).toBe("111560");
    expect(cell("EZ-F429", 2, 3).doi).toBe("78.21");
    expect(cell("EZ-F430", 2, 3).dow).toBe("111720");
    expect(cell("EZ-F430", 2, 3).doi).toBe("77.74");
  });
});

// ---------------------------------------------------------------------------
// §5 Index / %MAC formula constants (AHM 560 s.15-16)
// ---------------------------------------------------------------------------
describe("§5 index formula constants", () => {
  it("matches Ref.Sta, K, C, MAC length, LEMAC", () => {
    expect(data.indexFormula.refSta).toBe("33.1555");
    expect(data.indexFormula.k).toBe("100");
    expect(data.indexFormula.c).toBe("2500");
    expect(data.indexFormula.macLength).toBe("7.270");
    expect(data.indexFormula.lemac).toBe("31.3380");
  });

  it("derived constants: Ref.Sta - LEMAC = 1.8175, MAC/100 = 0.0727", () => {
    expect(data.indexFormula.derived.refStaMinusLemac).toBe("1.8175");
    expect(data.indexFormula.derived.macOver100).toBe("0.0727");
  });
});

// ---------------------------------------------------------------------------
// §6 Stabilizer trim curve (AHM 560 s.16)
// ---------------------------------------------------------------------------
describe("§6 stabilizer trim curve", () => {
  it("has the 4 documented breakpoints", () => {
    const curve = data.indexFormula.stabTrimCurve;
    expect(curve).toEqual([
      { mac: "18", stab: "7", direction: "UP" },
      { mac: "21", stab: "7", direction: "UP" },
      { mac: "35", stab: "0", direction: "DOWN" },
      { mac: "40", stab: "0", direction: "DOWN" },
    ]);
  });

  it("STAB rounding rule is TRUNCATE to 1 decimal (T5 692: 4.155 -> 4.1)", () => {
    expect(data.indexFormula.roundingRules.stab.method).toBe("TRUNCATE");
    expect(data.indexFormula.roundingRules.stab.decimals).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §8 Fuel index tables (AHM 560 s.17-46) — 15 density tables
// ---------------------------------------------------------------------------
describe("§8 fuel index tables", () => {
  it("has all 15 density tables", () => {
    const densities = Object.keys(data.fuelIndex).sort();
    expect(densities).toEqual([
      "0.760", "0.765", "0.770", "0.775", "0.780", "0.785", "0.790", "0.795",
      "0.800", "0.805", "0.810", "0.815", "0.820", "0.825", "0.830",
    ]);
  });

  it("every table's last row is the FULL row", () => {
    for (const [density, rows] of Object.entries(data.fuelIndex)) {
      expect(rows.length, `density ${density} has rows`).toBeGreaterThan(0);
      expect(rows[rows.length - 1]!.fuelWeight, `density ${density} last row`).toBe("FULL");
    }
  });

  it("density 0.760, page 1 (s.17) sample rows match verbatim", () => {
    const expected: [string, string][] = [
      ["2000", "-2.09"], ["4000", "-4.25"], ["6000", "-6.35"], ["8000", "-8.40"],
      ["10000", "-7.70"], ["12000", "-3.72"], ["14000", "+1.10"], ["16000", "+1.18"],
      ["18000", "-0.78"], ["20000", "-2.70"], ["22000", "-4.57"], ["24000", "-6.40"],
      ["26000", "-8.22"], ["28000", "-9.97"], ["30000", "-11.70"], ["32000", "-13.39"],
      ["34000", "-15.05"], ["36000", "-16.68"], ["36500", "-17.09"], ["37000", "-12.00"],
      ["37500", "-6.84"], ["38000", "-1.63"], ["38500", "+3.57"], ["39000", "+7.75"],
      ["41500", "+5.83"], ["44000", "+3.98"], ["46500", "+2.27"], ["49000", "+0.95"],
      ["51500", "-0.03"], ["54000", "-0.63"], ["56500", "-0.82"], ["59000", "-0.58"],
      ["61500", "+0.04"],
    ];
    for (const [weight, index] of expected) {
      expect(fuelRow("0.760", weight).index, `0.760 @ ${weight}`).toBe(index);
    }
  });

  it("density 0.760, page 2 (s.18) sample rows match verbatim, ending in FULL", () => {
    const expected: [string, string][] = [
      ["64000", "+1.13"], ["66500", "+2.71"], ["69000", "+4.91"], ["71000", "+7.06"],
      ["73000", "+7.85"], ["75000", "+7.36"], ["77000", "+6.63"], ["79000", "+5.77"],
      ["81000", "+4.84"], ["83000", "+3.89"], ["85000", "+2.93"], ["87000", "+1.99"],
      ["89000", "+1.07"], ["91000", "+0.18"], ["93000", "-0.71"], ["95000", "-1.57"],
      ["97000", "-2.47"], ["99000", "-3.41"], ["101000", "-4.47"], ["103000", "-5.74"],
      ["105000", "-7.62"],
    ];
    for (const [weight, index] of expected) {
      expect(fuelRow("0.760", weight).index, `0.760 @ ${weight}`).toBe(index);
    }
    expect(fuelRow("0.760", "FULL").index).toBe("-8.98");
  });

  it("density 0.830 tail matches verbatim (upper density boundary check)", () => {
    expect(fuelRow("0.830", "113000").index).toBe("-9.34");
    expect(fuelRow("0.830", "115000").index).toBe("-11.09");
    expect(fuelRow("0.830", "FULL").index).toBe("-9.80");
  });

  it("fuel weight is not required to be monotonic in index (documented as normal)", () => {
    // 8000kg dips to -8.40, then 16000kg rises to +1.18 — this is a real
    // tank-filling-order effect, not a data error. No monotonicity assertion
    // is made here on purpose (GROUND_TRUTH.md §8).
    expect(fuelRow("0.760", "8000").index).toBe("-8.40");
    expect(fuelRow("0.760", "16000").index).toBe("+1.18");
  });
});

// ---------------------------------------------------------------------------
// §9 Cockpit / courier / galley index influence (AHM 560 s.47, s.52)
// ---------------------------------------------------------------------------
describe("§9 crew index influence", () => {
  it("cockpit: 4 seats, arm -23.807, index/kg -0.00952", () => {
    expect(data.crewIndex.cockpit.maxSeats).toBe(4);
    expect(data.crewIndex.cockpit.armFromRefSta).toBe("-23.807");
    expect(data.crewIndex.cockpit.indexPerKg).toBe("-0.00952");
  });

  it("courier seats: aft of lavatory (2) and aft of courier stowage (4)", () => {
    const lav = data.crewIndex.courier.find((c) => c.location === "AFT_OF_LAVATORY_L11")!;
    expect(lav.maxSeats).toBe(2);
    expect(lav.armFromRefSta).toBe("-21.555");
    expect(lav.indexPerKg).toBe("-0.00862");

    const stow = data.crewIndex.courier.find((c) => c.location === "AFT_OF_COURIER_STOWAGE")!;
    expect(stow.maxSeats).toBe(4);
    expect(stow.armFromRefSta).toBe("-21.555");
    expect(stow.indexPerKg).toBe("-0.00862");
  });

  it("galley (courier stowage): arm -22.3555, index/kg -0.00864", () => {
    const g = data.crewIndex.galley[0]!;
    expect(g.armFromRefSta).toBe("-22.3555");
    expect(g.indexPerKg).toBe("-0.00864");
  });

  it("cabin configuration is 6 YC, 2 aft-of-lavatory + 4 aft-of-courier-stowage", () => {
    expect(data.crewIndex.cabinConfiguration.code).toBe("6 YC");
    expect(data.crewIndex.cabinConfiguration.courierAreaSeats).toBe(6);
    expect(data.crewIndex.cabinConfiguration.standardCourierSplit).toEqual({
      aftOfLavatory: 2,
      aftOfCourierStowage: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// §10 CG limits for loadsheet purposes (AHM 560 s.49-50)
// ---------------------------------------------------------------------------
describe("§10 CG limits", () => {
  it("ZFW forward breakpoints", () => {
    expect(data.cgLimits.zfw.forward).toEqual([
      { weight: "116000", index: "100.88" },
      { weight: "128960", index: "98.24" },
      { weight: "131759", index: "97.47" },
      { weight: "135440", index: "95.65" },
      { weight: "143000", index: "90.20" },
      { weight: "144080", index: "86.99" },
      { weight: "170000", index: "81.72" },
    ]);
  });

  it("ZFW aft breakpoints", () => {
    expect(data.cgLimits.zfw.aft).toEqual([
      { weight: "116000", index: "141.62" },
      { weight: "167840", index: "163.72" },
      { weight: "168920", index: "165.20" },
      { weight: "170000", index: "164.45" },
    ]);
  });

  it("TAKEOFF forward breakpoints", () => {
    expect(data.cgLimits.takeoff.forward).toEqual([
      { weight: "116000", index: "85.61" },
      { weight: "210000", index: "66.50" },
      { weight: "223364", index: "76.64" },
      { weight: "233000", index: "99.29" },
    ]);
  });

  it("TAKEOFF aft breakpoints", () => {
    expect(data.cgLimits.takeoff.aft).toEqual([
      { weight: "116000", index: "115.28" },
      { weight: "118200", index: "115.73" },
      { weight: "169000", index: "157.83" },
      { weight: "179000", index: "166.12" },
      { weight: "228625", index: "175.13" },
      { weight: "233000", index: "131.20" },
    ]);
  });

  it("landing CG limits are left unpopulated pending operational confirmation (§21 Q3)", () => {
    expect(data.cgLimits.landing.forward).toEqual([]);
    expect(data.cgLimits.landing.aft).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §11 Compartment trim details (AHM 560 s.54, s.4, s.77)
// ---------------------------------------------------------------------------
describe("§11 compartment limits", () => {
  it("5 compartments with correct max gross / index per kg", () => {
    const byNum = (n: number) => data.compartments.compartments.find((c) => c.number === n)!;
    expect(byNum(1).maxGrossPair).toBe("18869");
    expect(byNum(1).indexPerKg).toBe("-0.00609");
    expect(byNum(2).maxGrossPair).toBe("18869");
    expect(byNum(2).indexPerKg).toBe("-0.00379");
    expect(byNum(3).maxGrossPair).toBe("15241");
    expect(byNum(3).indexPerKg).toBe("0.00243");
    expect(byNum(4).maxGrossPair).toBe("15241");
    expect(byNum(4).indexPerKg).toBe("0.00444");
    expect(byNum(5).maxGrossPair).toBe("3468");
    expect(byNum(5).indexPerKg).toBe("0.00630");
  });

  it("LIR sub-limits: comp1 12696, comp2/3/4 10206 each, comp5 (bulk) 3468", () => {
    const byNum = (n: number) => data.compartments.compartments.find((c) => c.number === n)!;
    expect(byNum(1).lirSubLimit).toBe("12696");
    expect(byNum(2).lirSubLimit).toBe("10206");
    expect(byNum(3).lirSubLimit).toBe("10206");
    expect(byNum(4).lirSubLimit).toBe("10206");
    expect(byNum(5).lirSubLimit).toBe("3468");
  });

  it("main deck max load is 62000 kg", () => {
    expect(data.compartments.mainDeckMaxLoad).toBe("62000");
  });
});

// ---------------------------------------------------------------------------
// §12 Combined Load Limitations (AHM 560 s.55-56) — 168 cells (14 zones x 12 bands)
// ---------------------------------------------------------------------------
describe("§12 combined load limitations", () => {
  it("has 17 zones total (14 limited + 3 wing box)", () => {
    expect(data.combinedLoad.zones.length).toBe(17);
  });

  it("has exactly 168 limit cells across all limited zones", () => {
    let count = 0;
    for (const z of data.combinedLoad.zones) {
      if (z.limits) count += Object.keys(z.limits).length;
    }
    expect(count).toBe(168);
  });

  it("wing box zones (ZF/ZG/ZH) have no limits", () => {
    for (const zn of ["ZF", "ZG", "ZH"]) {
      expect(findZone(zn).limits).toBeNull();
    }
  });

  it("ZFCG < 25% MAC table matches AHM 560 s.55 verbatim", () => {
    const table: Record<string, number[]> = {
      ZA: [4807, 4726, 4686, 4645, 4605, 4564],
      ZB: [7089, 6926, 6845, 6764, 6683, 6601],
      ZC: [11911, 11607, 11455, 11303, 11151, 10999],
      ZD: [16479, 16088, 15893, 15698, 15502, 15307],
      ZE: [20284, 19821, 19589, 19357, 19125, 18893],
      ZJ: [28450, 29014, 29579, 29861, 30143, 30425],
      ZK: [26664, 27228, 27792, 28075, 28357, 28639],
      ZL: [22348, 22811, 23273, 23504, 23735, 23966],
      ZM: [20302, 20691, 21080, 21274, 21468, 21663],
      ZP: [17534, 17831, 18128, 18277, 18426, 18574],
      ZR: [12249, 12400, 12551, 12626, 12701, 12777],
      ZS: [9716, 9802, 9888, 9931, 9973, 10016],
      ZT: [6489, 6518, 6547, 6562, 6576, 6591],
      ZU: [3739, 3743, 3747, 3749, 3751, 3753],
    };
    const bands = [
      "21<=ZFCG<22", "22<=ZFCG<23", "23<=ZFCG<23.5",
      "23.5<=ZFCG<24", "24<=ZFCG<24.5", "24.5<=ZFCG<25",
    ];
    for (const [zone, values] of Object.entries(table)) {
      const z = findZone(zone);
      bands.forEach((band, i) => {
        expect(z.limits![band], `${zone} ${band}`).toBe(String(values[i]));
      });
    }
  });

  it("ZFCG >= 25% MAC table matches AHM 560 s.56 verbatim (typo band corrected to 25<=ZFCG<26)", () => {
    const table: Record<string, number[]> = {
      ZA: [4484, 4403, 4322, 4242, 4161, 3515],
      ZB: [6439, 6277, 6114, 5952, 5790, 4491],
      ZC: [10695, 10391, 10087, 9783, 9479, 7047],
      ZD: [14916, 14526, 14135, 13744, 13354, 10229],
      ZE: [18429, 17965, 17501, 17037, 16573, 12862],
      ZJ: [30708, 31272, 31837, 32401, 32965, 33530],
      ZK: [28921, 29486, 30050, 30615, 31179, 31743],
      ZL: [24197, 24660, 25122, 25584, 26046, 26509],
      ZM: [21857, 22246, 22635, 23024, 23413, 23802],
      ZP: [18723, 19020, 19318, 19615, 19912, 20209],
      ZR: [12852, 13003, 13154, 13304, 13455, 13606],
      ZS: [10059, 10145, 10231, 10316, 10402, 10488],
      ZT: [6605, 6634, 6663, 6693, 6722, 6751],
      ZU: [3755, 3759, 3763, 3767, 3771, 3775],
    };
    const bands = [
      "25<=ZFCG<26", "26<=ZFCG<27", "27<=ZFCG<28",
      "28<=ZFCG<29", "29<=ZFCG<30", "30<=ZFCG<38",
    ];
    for (const [zone, values] of Object.entries(table)) {
      const z = findZone(zone);
      bands.forEach((band, i) => {
        expect(z.limits![band], `${zone} ${band}`).toBe(String(values[i]));
      });
    }
  });

  it("FWD_CANTILEVER zones cumulate nose-to-tail, AFT_CANTILEVER tail-to-nose", () => {
    for (const zn of ["ZA", "ZB", "ZC", "ZD", "ZE"]) {
      expect(findZone(zn).cumulativeDirection).toBe("FWD_TO_AFT");
    }
    for (const zn of ["ZJ", "ZK", "ZL", "ZM", "ZP", "ZR", "ZS", "ZT", "ZU"]) {
      expect(findZone(zn).cumulativeDirection).toBe("AFT_TO_FWD");
    }
  });
});

// ---------------------------------------------------------------------------
// §13 Lower deck bay/section indices (AHM 560 s.57-60)
// ---------------------------------------------------------------------------
describe("§13 lower deck positions", () => {
  it("bulk bays 51/52/53", () => {
    expect(findPosition("51").maxGross).toBe("339");
    expect(findPosition("51").indexPerKg).toBe("0.00571");
    expect(findPosition("52").maxGross).toBe("1413");
    expect(findPosition("52").indexPerKg).toBe("0.00592");
    expect(findPosition("53").maxGross).toBe("1716");
    expect(findPosition("53").indexPerKg).toBe("0.00674");
  });

  it("all 13 containers have max gross 3174", () => {
    const codes = ["11", "12", "13", "14", "21", "22", "23", "31", "32", "33", "41", "42", "43"];
    for (const c of codes) {
      expect(findPosition(c, "CONTAINER").maxGross, c).toBe("3174");
    }
  });

  it("container index values match s.58", () => {
    const expected: Record<string, string> = {
      "11": "-0.00709", "12": "-0.00638", "13": "-0.00575", "14": "-0.00512",
      "21": "-0.00441", "22": "-0.00378", "23": "-0.00315",
      "31": "0.00178", "32": "0.00241", "33": "0.00305",
      "41": "0.00384", "42": "0.00447", "43": "0.00510",
    };
    for (const [code, idx] of Object.entries(expected)) {
      expect(findPosition(code, "CONTAINER").indexPerKg, code).toBe(idx);
    }
  });

  it("88x125 pallets: max gross 4626, indices match s.59", () => {
    const expected: Record<string, string> = {
      "12P": "-0.00624", "13P": "-0.00526", "21P": "-0.00427", "22P": "-0.00329",
      "31P": "0.00192", "32P": "0.00291", "41P": "0.00398", "42P": "0.00488",
    };
    for (const [code, idx] of Object.entries(expected)) {
      const p = findPosition(code, "PALLET_88x125");
      expect(p.maxGross, code).toBe("4626");
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("96x125 pallets: max gross 5103, indices match s.60", () => {
    const expected: Record<string, string> = {
      "12P": "-0.00628", "13P": "-0.00530", "21P": "-0.00431", "22P": "-0.00333",
      "31P": "0.00196", "32P": "0.00295", "41P": "0.00394", "42P": "0.00492",
    };
    for (const [code, idx] of Object.entries(expected)) {
      const p = findPosition(code, "PALLET_96x125");
      expect(p.maxGross, code).toBe("5103");
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("11P and 43P do not exist as lower-deck pallet positions", () => {
    expect(data.positions.positions.some((p) => p.code === "11P")).toBe(false);
    expect(data.positions.positions.some((p) => p.code === "43P")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §14 Main deck bay/section indices (AHM 560 s.61-67)
// ---------------------------------------------------------------------------
describe("§14 main deck positions", () => {
  it("single row 88x125 (s.61)", () => {
    const expected: [string, string, string][] = [
      ["A", "2826", "-0.00696"], ["B", "3123", "-0.00605"], ["C", "3391", "-0.00515"],
      ["D", "3391", "-0.00424"], ["E", "4687", "-0.00334"], ["F", "6033", "-0.00243"],
      ["G", "6033", "-0.00153"], ["H", "6033", "-0.00063"], ["J", "6033", "0.00028"],
      ["K", "5945", "0.00118"], ["L", "4037", "0.00209"], ["M", "4037", "0.00299"],
      ["P", "3725", "0.00389"], ["R", "3714", "0.00496"], ["S", "3714", "0.00595"],
      ["T", "3059", "0.00693"], ["U", "2541", "0.00792"],
    ];
    for (const [code, gross, idx] of expected) {
      const p = findPosition(code, "SINGLE_ROW_88x125");
      expect(p.maxGross, code).toBe(gross);
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("single row 96x125 (s.62)", () => {
    const expected: [string, string, string][] = [
      ["AA", "3080", "-0.00692"], ["BB", "3428", "-0.00593"], ["CC", "3696", "-0.00494"],
      ["DD", "3696", "-0.00396"], ["EE", "5670", "-0.00297"], ["FF", "5670", "-0.00199"],
      ["GG", "5670", "-0.00100"], ["HH", "5670", "-0.00002"], ["JJ", "5670", "0.00097"],
      ["KK", "4822", "0.00196"], ["LL", "4400", "0.00295"], ["MM", "4091", "0.00394"],
      ["PP", "4048", "0.00492"], ["RR", "4048", "0.00591"], ["SS", "3389", "0.00689"],
      ["TT", "2809", "0.00788"],
    ];
    for (const [code, gross, idx] of expected) {
      const p = findPosition(code, "SINGLE_ROW_96x125");
      expect(p.maxGross, code).toBe(gross);
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("single row 125x96 (s.63)", () => {
    const expected: [string, string, string][] = [
      ["AB", "3429", "-0.00677"], ["BC", "3941", "-0.00549"], ["CE", "4001", "-0.00421"],
      ["EF", "6804", "-0.00293"], ["FH", "6804", "-0.00165"], ["HJ", "6804", "-0.00037"],
      ["JK", "6804", "0.00091"], ["KM", "4868", "0.00219"], ["MP", "4445", "0.00348"],
    ];
    for (const [code, gross, idx] of expected) {
      const p = findPosition(code, "SINGLE_ROW_125x96");
      expect(p.maxGross, code).toBe(gross);
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("side-by-side 125x88 (s.64): R and L pairs, 10 pairs including PRR/PRL", () => {
    const expected: [string, string, string][] = [
      ["AB", "2000", "-0.00677"], ["BC", "2358", "-0.00549"], ["CE", "2400", "-0.00421"],
      ["EF", "3825", "-0.00293"], ["FH", "4321", "-0.00165"], ["HJ", "4321", "-0.00037"],
      ["JK", "4321", "0.00091"], ["KM", "2964", "0.00219"], ["MP", "2756", "0.00348"],
      ["PR", "2629", "0.00477"],
    ];
    for (const [code, gross, idx] of expected) {
      for (const side of ["R", "L"]) {
        const p = findPosition(code + side, "SIDE_BY_SIDE_125x88");
        expect(p.maxGross, code + side).toBe(gross);
        expect(p.indexPerKg, code + side).toBe(idx);
      }
    }
  });

  it("side-by-side 125x96 (s.65): same values as 125x88 but no PRR/PRL pair", () => {
    const expected: [string, string, string][] = [
      ["AB", "2000", "-0.00677"], ["BC", "2358", "-0.00549"], ["CE", "2400", "-0.00421"],
      ["EF", "3825", "-0.00293"], ["FH", "4321", "-0.00165"], ["HJ", "4321", "-0.00037"],
      ["JK", "4321", "0.00091"], ["KM", "2964", "0.00219"], ["MP", "2756", "0.00348"],
    ];
    for (const [code, gross, idx] of expected) {
      for (const side of ["R", "L"]) {
        const p = findPosition(code + side, "SIDE_BY_SIDE_125x96");
        expect(p.maxGross, code + side).toBe(gross);
        expect(p.indexPerKg, code + side).toBe(idx);
      }
    }
    expect(data.positions.positions.some(
      (p) => (p.code === "PRR" || p.code === "PRL") && p.uldType === "SIDE_BY_SIDE_125x96",
    )).toBe(false);
  });

  it("16ft pallets (s.66)", () => {
    const expected: [string, string, string][] = [
      ["CFR", "7729", "-0.00385"], ["FJR", "10668", "-0.00137"],
      ["JLR", "10668", "0.00070"], ["LPR", "6236", "0.00274"],
    ];
    for (const [code, gross, idx] of expected) {
      const p = findPosition(code, "PALLET_16FT");
      expect(p.maxGross, code).toBe(gross);
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("20ft pallets (s.67)", () => {
    const expected: [string, string, string][] = [
      ["CFG", "10602", "-0.00361"], ["FJG", "11340", "-0.00114"], ["JLG", "11340", "0.00131"],
    ];
    for (const [code, gross, idx] of expected) {
      const p = findPosition(code, "PALLET_20FT");
      expect(p.maxGross, code).toBe(gross);
      expect(p.indexPerKg, code).toBe(idx);
    }
  });

  it("16/20ft pallet zone distribution coefficients sum to 1.0 for every position", () => {
    for (const entry of data.zoneMapping.longPalletDistribution) {
      const sum = entry.distribution.reduce((acc, d) => acc + Number(d.factor), 0);
      expect(sum, entry.position).toBeCloseTo(1.0, 6);
    }
  });

  it("zone distribution matches AHM 560 s.76 verbatim", () => {
    const byPos = Object.fromEntries(
      data.zoneMapping.longPalletDistribution.map((e) => [e.position, e.distribution]),
    );
    expect(byPos["CFR"]).toEqual([
      { zone: "ZD", factor: "0.6" },
      { zone: "ZE", factor: "0.4" },
    ]);
    expect(byPos["FJR"]).toEqual([
      { zone: "ZE", factor: "0.2" },
      { zone: "ZF", factor: "0.5" },
      { zone: "ZG", factor: "0.3" },
    ]);
    expect(byPos["JLR"]).toEqual([
      { zone: "ZJ", factor: "0.2" },
      { zone: "ZK", factor: "0.5" },
      { zone: "ZL", factor: "0.3" },
    ]);
    expect(byPos["LPR"]).toEqual([
      { zone: "ZL", factor: "0.4" },
      { zone: "ZM", factor: "0.5" },
      { zone: "ZP", factor: "0.1" },
    ]);
    expect(byPos["CFG"]).toEqual([
      { zone: "ZD", factor: "0.2" },
      { zone: "ZE", factor: "0.4" },
      { zone: "ZF", factor: "0.4" },
    ]);
    expect(byPos["FJG"]).toEqual([
      { zone: "ZF", factor: "0.1" },
      { zone: "ZG", factor: "0.4" },
      { zone: "ZH", factor: "0.4" },
      { zone: "ZJ", factor: "0.1" },
    ]);
    expect(byPos["JLG"]).toEqual([
      { zone: "ZJ", factor: "0.2" },
      { zone: "ZK", factor: "0.4" },
      { zone: "ZL", factor: "0.4" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// §15/§16 ULD types and ballast (AHM 560 s.70, s.68)
// ---------------------------------------------------------------------------
describe("§15 ULD types", () => {
  it("matches the 5 documented type codes (PLA/FLA share one row)", () => {
    const byCode = (c: string) => data.uldTypes.types.find((t) => t.typeCode === c)!;
    expect(byCode("PLA").tareWeight).toBe("115");
    expect(byCode("PLA").grossWeight).toBe("3175");
    expect(byCode("PLA").volume).toBe("6.94");
    expect(byCode("PAG").tareWeight).toBe("120");
    expect(byCode("PAG").grossWeight).toBe("4626");
    expect(byCode("PAG").volume).toBe("9.91");
    expect(byCode("PMC").tareWeight).toBe("120");
    expect(byCode("PMC").grossWeight).toBe("5035");
    expect(byCode("PMC").volume).toBe("15.8");
    expect(byCode("PZA").tareWeight).toBe("454");
    expect(byCode("PZA").grossWeight).toBe("11340");
    expect(byCode("PZA").volume).toBe("29.4");
    expect(byCode("PGA").tareWeight).toBe("545");
    expect(byCode("PGA").grossWeight).toBe("13608");
    expect(byCode("PGA").volume).toBe("35.8");
  });
});

describe("§16 ballast", () => {
  it("two PMC ballast entries: 2865 and 3025 kg", () => {
    const weights = data.uldTypes.ballast.map((b) => b.grossWeight).sort();
    expect(weights).toEqual(["2865", "3025"]);
    for (const b of data.uldTypes.ballast) {
      expect(b.uldType).toBe("PMC");
    }
  });
});

// ---------------------------------------------------------------------------
// Structural validations (Faz 2 acceptance criteria)
// ---------------------------------------------------------------------------
describe("structural validations", () => {
  it("all 15 fuel density tables are present and complete", () => {
    expect(Object.keys(data.fuelIndex).length).toBe(15);
  });

  it("every position has a non-empty index value", () => {
    for (const p of data.positions.positions) {
      expect(p.indexPerKg.length, p.code).toBeGreaterThan(0);
    }
  });

  it("zone distribution coefficients sum to 1.0 (repeated as an explicit structural check)", () => {
    for (const entry of data.zoneMapping.longPalletDistribution) {
      const sum = entry.distribution.reduce((acc, d) => acc + Number(d.factor), 0);
      expect(sum).toBeCloseTo(1.0, 6);
    }
  });

  it("main deck has 87 positions, lower deck has 32", () => {
    const main = data.positions.positions.filter((p) => p.deck === "MAIN");
    const lower = data.positions.positions.filter((p) => p.deck === "LOWER");
    expect(main.length).toBe(87);
    expect(lower.length).toBe(32);
  });
});
