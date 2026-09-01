import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderLoadsheetPdf } from "../src/loadsheet/loadsheet-document";
import type { LoadsheetInput } from "../src/loadsheet/types";
import type { LirCell } from "../src/lir/types";

// docs/AHM560_GROUND_TRUTH.md §19 — T5 692, SGN -> ASB, 2026-08-11, EZ-F430.
const mainDeckCodes = [
  "ABL", "ABR", "BCL", "BCR", "CEL", "CER", "EFL", "EFR", "FHL", "FHR",
  "HJL", "HJR", "JKL", "JKR", "KML", "KMR", "MPL", "MPR", "PP", "RR", "SS", "TT",
];
const mainWeights = [717, 834, 915, 919, 925, 952, 956, 1019, 1022, 1029, 1285, 1104, 1089, 1094, 1068, 1096, 1575, 1702, 2125, 1856, 1528, 2119];
const mainUld = ["06154", "06115", "06298", "06017", "06589", "06586", "06743", "06141", "0029", "06505", "06507", "06628", "06683", "06668", "06591", "06273", "06730", "06102", "06014", "06332", "06243", "06064"];

const cells: LirCell[] = mainDeckCodes.map((code, i) => ({
  code,
  deck: "MAIN",
  maxGross: "2000",
  uldCode: mainUld[i]!,
  awb: null,
  weight: String(mainWeights[i]),
}));

const lowerRows: [string, string | null, number][] = [
  ["11", "05185", 472],
  ["12P", "06645", 800],
  ["13P", "06672", 835],
  ["21P", "06116", 846],
  ["22P", "06094", 871],
  ["31P", "06044", 876],
  ["32P", "0002", 916],
  ["41P", "06530", 1003],
  ["42P", "06284", 1050],
  ["52", null, 340],
  ["53", null, 340],
];
for (const [code, uld, w] of lowerRows) {
  cells.push({ code, deck: "LOWER", maxGross: "3174", uldCode: uld, awb: null, weight: String(w) });
}

const sampleInput: LoadsheetInput = {
  station: "SGN",
  destination: "ASB",
  flightNo: "T5 692",
  date: "11/08/2026",
  time: "22:00",
  aircraftType: "A330-243",
  registration: "EZ-F430",
  version: "P2F",
  cockpitCrew: 2,
  courierCrew: 3,
  editionNo: "01",
  preparedBy: "Bezirgen",
  checkedBy: "Checker User",

  ahmEdition: 1,
  ahmRevision: 0,

  dow: "111043.7",
  doi: "78.22",
  fuelDensity: "0.785",

  passengerCount: 0,
  cabinBagWeight: "0",

  ttl: "35278",
  zfw: "146321.7",
  mzfw: "170000",
  takeoffFuel: "44700",
  tow: "191021.7",
  mtow: "233000",
  tripFuel: "36660",
  ldw: "154361.7",
  mlw: "182000",
  taxiFuel: "600",
  taxiWeight: "191621.7",
  mtw: "233500",

  underloadBeforeLmc: "23678.3",

  lizfw: "106.07",
  litow: "109.39",
  lilaw: "106.5",
  maczfw: "26.4",
  mactow: "26.7",
  maclaw: "26.5",
  stab: { value: "4.1", direction: "DOWN" },

  zfwForwardLimit: "87.4",
  zfwAftLimit: "154.3",
  towForwardLimit: "71.1",
  towAftLimit: "166.6",

  compartments: [
    { target: "main deck", actual: "26929", max: "62000", withinLimit: true },
    { target: "compartment 1 (FWD)", actual: "3824", max: "18869", withinLimit: true },
    { target: "compartment 5 (BULK)", actual: "680", max: "3468", withinLimit: true },
  ],
  cells,

  lastMinuteChanges: [],

  specialInformation: "Handle with care.",
  watermark: true,
};

describe("renderLoadsheetPdf", () => {
  it("renders a valid PDF without throwing", async () => {
    const buffer = await renderLoadsheetPdf(sampleInput);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produces byte-identical output for identical input (determinism)", async () => {
    const a = await renderLoadsheetPdf(sampleInput);
    const b = await renderLoadsheetPdf(sampleInput);
    const hashA = createHash("sha256").update(a).digest("hex");
    const hashB = createHash("sha256").update(b).digest("hex");
    expect(hashA).toBe(hashB);
  });

  it("produces different output when the watermark flag differs", async () => {
    const withWatermark = await renderLoadsheetPdf({ ...sampleInput, watermark: true });
    const without = await renderLoadsheetPdf({ ...sampleInput, watermark: false });
    expect(withWatermark.equals(without)).toBe(false);
  });

  it("produces different output when MACTOW differs", async () => {
    const a = await renderLoadsheetPdf(sampleInput);
    const b = await renderLoadsheetPdf({ ...sampleInput, mactow: "99.9" });
    expect(a.equals(b)).toBe(false);
  });

  it("fits the full T5 692 golden load on a single A4 page", async () => {
    const buffer = await renderLoadsheetPdf(sampleInput);
    const text = buffer.toString("latin1");
    const pageCount = (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    expect(pageCount).toBe(1);
  });
});
