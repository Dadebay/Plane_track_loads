/**
 * One fixture for all three documents — the same flight, the same plate,
 * the same load, exactly as production feeds them (docs/
 * AHM560_GROUND_TRUTH.md §19: T5 692, SGN -> ASB, 2026-08-11, EZ-F430).
 *
 * Shared on purpose: Aşama 7's requirement is that LIR, LS and ENV are
 * driven by one layout, so the tests prove it by building one input set
 * and feeding all three renderers from it. No personal data — the crew
 * names here are role placeholders.
 */

import { buildDeckLayout, buildEnvelopeExtent } from "@tua/wnb-core";
import type { Position, PositionConfiguration } from "@tua/wnb-core";
import type {
  DocumentDeckLayout,
  DocumentHeader,
  DocumentUldLine,
} from "../src/shared/types";

export const header: DocumentHeader = {
  station: "SGN",
  flightNo: "T5 692",
  date: "11/08/2026",
  aircraftType: "A330-243 P2F",
  registration: "EZ-F430",
  editionNo: "01",
  preparedBy: "Load Controller",
  checkedBy: "Checker",
};

const configurations: PositionConfiguration[] = [
  {
    id: "SIDE_BY_SIDE_125x96",
    label: 'SIDE BY SIDE 125"x96"',
    deck: "MAIN",
    longitudinalInches: "96",
    lateralInches: "125",
    lateralPlacement: "PAIRED_LEFT_RIGHT",
  },
  {
    id: "SINGLE_ROW_96x125",
    label: 'SINGLE ROW 96"x125"',
    deck: "MAIN",
    longitudinalInches: "125",
    lateralInches: "96",
    lateralPlacement: "CENTRE",
  },
  {
    id: "PALLET_96x125",
    label: 'PALLET 96"x125"',
    deck: "LOWER",
    longitudinalInches: "125",
    lateralInches: "96",
    lateralPlacement: "CENTRE",
  },
  {
    id: "SINGLE_ROW_60x125",
    label: 'SINGLE ROW 60.4"x125"',
    deck: "LOWER",
    longitudinalInches: "125",
    lateralInches: "60.4",
    lateralPlacement: "CENTRE",
  },
];

const sideBySide = ["ABL", "ABR", "BCL", "BCR", "CEL", "CER", "EFL", "EFR", "FHL", "FHR"];
const singleRow = ["PP", "RR", "SS", "TT"];
const lowerPallets = ["12P", "13P", "21P", "22P", "31P", "32P", "41P", "42P"];
const lowerSingles = ["11", "52", "53"];

const positions: Position[] = [
  ...sideBySide.map((code) => ({
    code,
    deck: "MAIN" as const,
    uldType: "SIDE_BY_SIDE_125x96",
    maxGross: "2000",
    indexPerKg: "-0.0140",
  })),
  ...singleRow.map((code) => ({
    code,
    deck: "MAIN" as const,
    uldType: "SINGLE_ROW_96x125",
    maxGross: "2826",
    indexPerKg: "0.0121",
  })),
  ...lowerPallets.map((code) => ({
    code,
    deck: "LOWER" as const,
    uldType: "PALLET_96x125",
    maxGross: "3174",
    indexPerKg: "-0.0080",
  })),
  ...lowerSingles.map((code) => ({
    code,
    deck: "LOWER" as const,
    uldType: "SINGLE_ROW_60x125",
    maxGross: "1413",
    indexPerKg: "0.0069",
  })),
];

/** position -> [ULD, tare, net]. Positions absent from this map print "N"
 * (empty) — every document must handle a part-loaded aircraft. */
const load: Record<string, [string, number, number]> = {
  ABL: ["06154", 100, 617],
  ABR: ["06115", 100, 734],
  BCL: ["06298", 100, 815],
  BCR: ["06017", 100, 819],
  CEL: ["06589", 100, 825],
  CER: ["06586", 100, 852],
  EFL: ["06743", 100, 856],
  EFR: ["06141", 100, 919],
  PP: ["06014", 120, 2005],
  RR: ["06332", 120, 1736],
  "12P": ["06645", 110, 690],
  "13P": ["06672", 110, 725],
  "21P": ["06116", 110, 736],
  "31P": ["06044", 110, 766],
  "11": ["05185", 90, 382],
};

/** ABR's neighbours on the mutually exclusive single-row configuration are
 * blocked while it is loaded — the shaded-cell path in the grid. */
const blocked = new Set(["SINGLE_ROW_96x125/SS"]);

const layoutData = buildDeckLayout(positions, configurations);

function decorate(rows: typeof layoutData.main) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    cells: row.cells.map((cell) => {
      const entry = load[cell.code];
      return {
        code: cell.code,
        maxGross: cell.maxGross,
        uldCode: entry ? entry[0] : null,
        awb: null,
        weight: entry ? String(entry[1] + entry[2]) : null,
        blocked: blocked.has(cell.key),
      };
    }),
  }));
}

export const layout: DocumentDeckLayout = {
  main: decorate(layoutData.main),
  lower: decorate(layoutData.lower),
};

export const ulds: DocumentUldLine[] = Object.entries(load).map(([position, [uldCode, tare, net]]) => ({
  position,
  uldCode,
  awb: null,
  contentCode: "C",
  tareWeight: String(tare),
  netWeight: String(net),
  grossWeight: String(tare + net),
}));

export const totalTrafficLoad = String(
  Object.values(load).reduce((sum, [, tare, net]) => sum + tare + net, 0),
);

export const compartmentLimits = [
  { number: 1, description: "Fwd compartment", lirSubLimit: "12696", pairedWith: 2, maxGrossPair: "18869" },
  { number: 2, description: "Fwd compartment", lirSubLimit: "10206", pairedWith: 1, maxGrossPair: "18869" },
  { number: 3, description: "Aft compartment", lirSubLimit: "10206", pairedWith: 4, maxGrossPair: "15241" },
  { number: 4, description: "Aft compartment", lirSubLimit: "10206", pairedWith: 3, maxGrossPair: "15241" },
  { number: 5, description: "Rear (Bulk) compartment", lirSubLimit: "3468", pairedWith: null, maxGrossPair: "3468" },
];

// cg-limits.json a330-243p2f — the same breakpoints the ENV PDF and the
// on-screen chart both draw.
export const zfwLimits = {
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

export const takeoffLimits = {
  forward: [
    { weight: "116000", index: "85.61" },
    { weight: "210000", index: "66.50" },
    { weight: "223364", index: "76.64" },
    { weight: "233000", index: "99.29" },
  ],
  aft: [
    { weight: "116000", index: "115.28" },
    { weight: "118200", index: "115.73" },
    { weight: "169000", index: "157.83" },
    { weight: "179000", index: "166.12" },
    { weight: "228625", index: "175.13" },
    { weight: "233000", index: "131.20" },
  ],
};

export const zfcg = { weight: "146321.7", index: "106.07", withinEnvelope: true };
export const tocg = { weight: "191021.7", index: "109.39", withinEnvelope: true };

export const extent = buildEnvelopeExtent({
  curves: [zfwLimits, takeoffLimits],
  points: [zfcg, tocg],
  weightReferences: ["182000", "116000"],
});
