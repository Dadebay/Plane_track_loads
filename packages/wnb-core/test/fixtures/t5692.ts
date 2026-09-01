/**
 * T5 692 golden test case fixture — docs/AHM560_GROUND_TRUTH.md §19.
 *
 * Loads real AHM 560 Ed.1/Rev.0 data via @tua/ahm-data (a devDependency,
 * test-only — src/ never imports it, keeping the package's runtime
 * dependency at decimal.js alone per CLAUDE.md rule #1) and assembles the
 * WnbInput exactly as documented in GROUND_TRUTH.md §19.1.
 */

import { loadAhmData } from "@tua/ahm-data";
import type { LoadItem, WnbInput } from "../../src/types";

const ahm = loadAhmData("a330-243p2f", 1, 0);

// GROUND_TRUTH.md §19.1 — main deck load (22 positions).
const mainDeckLoad: LoadItem[] = [
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
];

// GROUND_TRUTH.md §19.1 — lower deck load (11 positions).
const lowerDeckLoad: LoadItem[] = [
  { position: "11", weight: "472", awb: "05185" },
  { position: "12P", weight: "800", awb: "06645" },
  { position: "13P", weight: "835", awb: "06672" },
  { position: "21P", weight: "846", awb: "06116" },
  { position: "22P", weight: "871", awb: "06094" },
  { position: "31P", weight: "876", awb: "06044" },
  { position: "32P", weight: "916", awb: "0002" },
  { position: "41P", weight: "1003", awb: "06530" },
  { position: "42P", weight: "1050", awb: "06284" },
  { position: "52", weight: "340" },
  { position: "53", weight: "340" },
];

export const t5692LoadItems: LoadItem[] = [...mainDeckLoad, ...lowerDeckLoad];

// Lower-deck load uses the 96"x125" pallet variant everywhere per
// GROUND_TRUTH.md §19.1's "Tip" column — filter positions.json down to a
// single unambiguous entry per code the same way a real caller would
// (positions.json legitimately has two entries for codes like "12P", one
// per pallet size; a real load-planning UI resolves this from the ULD
// actually assigned to that position, not from the code alone).
const PALLET_96_CODES = new Set(["12P", "13P", "21P", "22P", "31P", "32P", "41P", "42P"]);
export const t5692Positions = ahm.positions.positions.filter(
  (p) => !(PALLET_96_CODES.has(p.code) && p.uldType !== "PALLET_96x125"),
);

export const t5692Input: WnbInput = {
  weightLimits: ahm.aircraft.weightLimits,
  dow: "111043.70",
  doi: "78.22",
  loadItems: t5692LoadItems,
  positions: t5692Positions,
  fuel: {
    density: "0.785",
    takeoffFuel: "44700",
    tripFuel: "36660",
    taxiFuel: "600",
  },
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
};

export const t5692ExpectedArithmetic = {
  ttl: "35278",
  zfw: "146321.7",
  tow: "191021.7",
  ldw: "154361.7",
  taxiWeight: "191621.7",
  underloadBeforeLmc: "23678.3",
};

// GROUND_TRUTH.md §19.2 — printed loadsheet values, taken as given inputs
// to independently verify the %MAC/STAB formula chain (see golden-t5692.test.ts).
export const t5692PrintedLoadsheet = {
  lizfw: "106.07",
  litow: "109.39",
  maczfw: "26.4",
  mactow: "26.7",
  stab: "4.1",
};
