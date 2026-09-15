/**
 * Four more real Turkmenistan Airlines flights that actually operated, taken
 * from the operator's own printed loadsheets (image-only PDFs, transcribed by
 * OCR and reconciled: every load recap sums to the printed TTL exactly).
 *
 * These are not a second golden case — the golden case stays T5 692. They
 * exist to pin the weight chain across four independent loads, two
 * registrations, two fuel densities and both loading styles (full-width
 * single-row positions vs. side-by-side halves), and to record the index
 * deltas against Aerometa so a regression in either direction is visible.
 *
 * Provenance and the reasoning behind each delta: docs/AHM560_GROUND_TRUTH.md
 * §20 Bulgu #7 and Bulgu #8. The source PDFs are operational documents and are
 * deliberately not committed.
 */

import { loadAhmData } from "@tua/ahm-data";
import type { LoadItem, WnbInput } from "../../src/types";

const ahm = loadAhmData("a330-243p2f", 1, 0);

// Same disambiguation the golden fixture makes — see t5692.ts.
const PALLET_96_CODES = new Set(["12P", "13P", "21P", "22P", "31P", "32P", "41P", "42P"]);
const positions = ahm.positions.positions.filter(
  (p) => !(PALLET_96_CODES.has(p.code) && p.uldType !== "PALLET_96x125"),
);

export interface ReferenceFlight {
  /** Flight number as printed. */
  flight: string;
  /** Date of operation, as printed (DD/MM/YYYY). */
  date: string;
  registration: string;
  crew: string;
  input: WnbInput;
  /** Weight chain as printed — we reproduce these exactly. */
  printedWeights: {
    ttl: string;
    zfw: string;
    tow: string;
    ldw: string;
    taxiWeight: string;
  };
  /** Balance figures as printed — we differ, for the documented reasons. */
  printedBalance: {
    lizfw: string;
    litow: string;
    maczfw: string;
    mactow: string;
    stab: string;
    underloadBeforeLmc: string;
  };
}

function build(
  flight: string,
  date: string,
  registration: string,
  crew: string,
  dow: string,
  doi: string,
  load: readonly (readonly [string, string])[],
  fuel: { density: string; takeoffFuel: string; tripFuel: string },
  printedWeights: ReferenceFlight["printedWeights"],
  printedBalance: ReferenceFlight["printedBalance"],
): ReferenceFlight {
  const loadItems: LoadItem[] = load.map(([position, weight]) => ({ position, weight }));
  return {
    flight,
    date,
    registration,
    crew,
    printedWeights,
    printedBalance,
    input: {
      weightLimits: ahm.aircraft.weightLimits,
      dow,
      doi,
      loadItems,
      positions,
      fuel: { ...fuel, taxiFuel: "600" },
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
    },
  };
}

export const referenceFlights: ReferenceFlight[] = [
  build(
    "T5 450", "19/07/2026", "EZ-F430", "2/4",
    "111123.70", "77.53",
    [["HH", "2130"], ["JJ", "326"], ["KK", "870"], ["LL", "1007"], ["MM", "1850"],
     ["PP", "2870"], ["RR", "1025"], ["11", "124"], ["53", "402"]],
    { density: "0.785", takeoffFuel: "29500", tripFuel: "22339" },
    { ttl: "10604", zfw: "121727.7", tow: "151227.7", ldw: "128888.7", taxiWeight: "151827.7" },
    { lizfw: "112.45", litow: "101.12", maczfw: "28.5", mactow: "25.3", stab: "4.8", underloadBeforeLmc: "49396" },
  ),
  build(
    "T5 478", "18/07/2026", "EZ-F429", "2/5",
    "111453.70", "74.93",
    [["CEL", "1590"], ["EFR", "1820"], ["FHL", "1030"], ["FHR", "760"], ["HJ", "3230"],
     ["JJ", "1010"], ["KK", "1530"], ["LL", "1510"], ["MM", "2930"], ["PP", "3140"],
     ["RR", "3400"], ["SS", "1590"], ["TT", "1500"],
     ["12P", "1490"], ["13P", "1580"], ["21P", "1030"], ["22P", "1140"]],
    { density: "0.785", takeoffFuel: "33200", tripFuel: "25641" },
    { ttl: "30280", zfw: "141733.7", tow: "174933.7", ldw: "149292.7", taxiWeight: "175533.7" },
    { lizfw: "110.36", litow: "95.89", maczfw: "27.5", mactow: "24.2", stab: "5.4", underloadBeforeLmc: "29720" },
  ),
  build(
    "T5 478", "25/07/2026", "EZ-F430", "2/4",
    "111123.70", "77.53",
    [["CC", "1070"], ["DD", "1570"], ["FHL", "750"], ["EE", "1600"], ["HJL", "1020"],
     ["HJR", "1610"], ["JKL", "2960"], ["JKR", "2740"], ["KML", "570"], ["KMR", "830"],
     ["MM", "2920"], ["PP", "2950"], ["RR", "1600"], ["SS", "1550"]],
    { density: "0.785", takeoffFuel: "32600", tripFuel: "25164" },
    { ttl: "23740", zfw: "134863.7", tow: "167463.7", ldw: "142299.7", taxiWeight: "168063.7" },
    { lizfw: "112.66", litow: "98.70", maczfw: "28.2", mactow: "24.7", stab: "5.1", underloadBeforeLmc: "36260" },
  ),
  build(
    "T5 478", "01/08/2026", "EZ-F429", "2/4",
    "111374", "75.62",
    [["DD", "920"], ["EE", "750"], ["FF", "750"], ["GG", "710"], ["HH", "610"],
     ["JJ", "1020"], ["KK", "1260"], ["LL", "1390"], ["MM", "1280"], ["PP", "1250"],
     ["RR", "1520"], ["SS", "710"], ["TT", "950"]],
    { density: "0.775", takeoffFuel: "31200", tripFuel: "23867" },
    { ttl: "13120", zfw: "124494", tow: "155694", ldw: "131827", taxiWeight: "156294" },
    { lizfw: "107.48", litow: "94.52", maczfw: "27.1", mactow: "23.8", stab: "5.6", underloadBeforeLmc: "46880" },
  ),
];
