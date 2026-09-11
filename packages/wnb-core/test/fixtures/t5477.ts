/**
 * T5 477 comparison fixture — docs/T5477_REFERENCE_TRANSCRIPTION.md.
 *
 * Second real Aerometa production output available to this project, after
 * T5 692. It matters for two reasons T5 692 could not cover:
 *
 *  - it is the *other* registration (EZ-F429), so it independently confirms
 *    the AHM 560 Ed.1 Rev.2 crew matrix on a second aircraft;
 *  - its landing weight sits 2 437 kg under MLW, which makes MLW the binding
 *    underload constraint. Aerometa's underload defect (GROUND_TRUTH.md
 *    Bulgu #1) is therefore far larger here than on T5 692 — 13 722 kg of
 *    phantom spare capacity instead of 1 044 kg.
 *
 * Sanitised: the reference PDFs name the preparer, checker and approver.
 * Those are real people; none of their names is reproduced here or anywhere
 * else in the repository. The source PDFs are not committed either.
 */

import { loadAhmData } from "@tua/ahm-data";
import type { LoadItem, Position, WnbInput } from "../../src/types";

// Ed.1 Rev.2 — the revision in operational use. See
// packages/ahm-data/data/a330-243p2f/ed1-rev2/PROVENANCE.md for which of its
// pages are Rev.2-sourced and which are carried forward from Rev.0.
const ahm = loadAhmData("a330-243p2f", 1, 2);

// LIR/LS main deck. `awb` carries the ULD identifier printed in the LIR's
// upper cell; the lower cell is the gross weight.
const mainDeckLoad: LoadItem[] = [
  { position: "AA", weight: "844", awb: "06467" },
  { position: "BB", weight: "1645", awb: "06538" },
  { position: "CC", weight: "1772", awb: "06475" },
  { position: "DD", weight: "1970", awb: "06757" },
  { position: "EE", weight: "2688", awb: "06388" },
  { position: "FF", weight: "3220", awb: "06381" },
  { position: "HJL", weight: "726", awb: "06754" },
  { position: "HJR", weight: "726", awb: "06755" },
  { position: "JKL", weight: "3352", awb: "05224" },
  { position: "JKR", weight: "4238", awb: "06100" },
  { position: "KML", weight: "733", awb: "06640" },
  { position: "KMR", weight: "730", awb: "06708" },
  { position: "MPL", weight: "2208", awb: "06723" },
  { position: "MPR", weight: "910", awb: "06379" },
  { position: "PP", weight: "3220", awb: "06292" },
  { position: "RR", weight: "1684", awb: "06636" },
  { position: "SS", weight: "774", awb: "06633" },
  { position: "TT", weight: "1534", awb: "06024" },
];

const lowerDeckLoad: LoadItem[] = [
  { position: "11", weight: "658", awb: "05204" },
  { position: "12P", weight: "680", awb: "06442" },
  { position: "13P", weight: "729", awb: "06574" },
  { position: "21P", weight: "728", awb: "06314" },
  { position: "22P", weight: "930", awb: "06589" },
  { position: "31P", weight: "1134", awb: "06217" },
  { position: "32P", weight: "1415", awb: "06156" },
  { position: "41P", weight: "1926", awb: "06129" },
  { position: "42P", weight: "2667", awb: "06576" },
];

export const t5477LoadItems: LoadItem[] = [...mainDeckLoad, ...lowerDeckLoad];

/**
 * The LIR states each occupied position's configuration row explicitly, so
 * unlike T5 692 there is no inference here: the HJ/JK/KM/MP bays are on the
 * `SIDE BY SIDE 125"x96"` row and the lower-deck pallets on `PALLET 96"x125"`.
 * Every other row on the LIR is `N` (empty).
 */
const SIDE_BY_SIDE_96_CODES = new Set(["HJL", "HJR", "JKL", "JKR", "KML", "KMR", "MPL", "MPR"]);
const PALLET_96_CODES = new Set(["12P", "13P", "21P", "22P", "31P", "32P", "41P", "42P"]);

export const t5477Positions: Position[] = ahm.positions.positions.filter((p) => {
  if (SIDE_BY_SIDE_96_CODES.has(p.code)) return p.uldType === "SIDE_BY_SIDE_125x96";
  if (PALLET_96_CODES.has(p.code)) return p.uldType === "PALLET_96x125";
  return true;
});

/** Ed.1 Rev.2 s.6, EZ-F429 cockpit 2 / courier 3. */
export const t5477DowDoi = { dow: "111294", doi: "76.29" } as const;

export const t5477Input: WnbInput = {
  weightLimits: ahm.aircraft.weightLimits,
  dow: t5477DowDoi.dow,
  doi: t5477DowDoi.doi,
  loadItems: t5477LoadItems,
  positions: t5477Positions,
  fuel: {
    density: "0.780",
    takeoffFuel: "61400",
    tripFuel: "36972",
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

/** Values printed on LS_T5477_05092026_ED178.pdf. Comparison evidence, never expected truth. */
export const t5477PrintedLoadsheet = {
  ttl: "43841",
  dow: "111293.70",
  doi: "76.31",
  zfw: "155134.7",
  tow: "216534.7",
  ldw: "179562.7",
  taxiWeight: "217134.7",
  lizfw: "100.78",
  litow: "99.82",
  maczfw: "25.2",
  mactow: "25",
  stab: "5",
  underloadBeforeLmc: "16159",
  zfwLimitFwd: "85.6",
  zfwLimitAft: "158",
  towLimitFwd: "72.2",
  towLimitAft: "171.2",
} as const;
