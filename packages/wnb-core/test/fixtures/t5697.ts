/**
 * T5 697 comparison fixture — ASB-HAN, 2026-10-01, EZ-F429, ED 06.
 *
 * Third real production output available to this project, and the one that
 * matters most for underload: the flight lands 12 228 kg under MLW while
 * the printed sheet claims 52 507 kg of spare capacity. That is Bulgu #1 —
 * a DOW rounded to 110 000, and no MLW/MTOW constraint — at its largest
 * yet. T5 692 showed 1 t of it, T5 477 showed 13,7 t, this one 40,3 t.
 *
 * It lands 228 kg under MZFW, right on the edge where the landing check
 * used to break: that check borrowed the ZFW curve, which ends at MZFW, so
 * the same route with a little more fuel was rejected outright.
 *
 * Sanitised: the printed sheet names the preparer and the approver. Those
 * are real people and their names are not reproduced here.
 */

import { loadAhmData } from "@tua/ahm-data";
import type { LoadItem, WnbInput } from "../../src/types";

const ahm = loadAhmData("a330-243p2f", 1, 2);

/** The whole load: five main-deck single-row positions and two lower-deck
 * containers. Every other position on the LIR reads `N`. */
export const t5697LoadItems: LoadItem[] = [
  { position: "LL", weight: "1177", awb: "06324" },
  { position: "MM", weight: "726", awb: "06056" },
  { position: "PP", weight: "1492", awb: "05238" },
  { position: "RR", weight: "1440", awb: "06347" },
  { position: "SS", weight: "1200", awb: "05216" },
  { position: "42", weight: "810", awb: "0005" },
  { position: "43", weight: "648", awb: "06058" },
];

/** Ed.1 Rev.2 s.6, EZ-F429 cockpit 2 / courier 3. The sheet prints
 * 111 293,70 / 76,31: the crew table is printed to whole kg, so every
 * weight derived from it sits 0,3 kg away. */
export const t5697DowDoi = { dow: "111294", doi: "76.29" } as const;

export const t5697Input: WnbInput = {
  weightLimits: ahm.aircraft.weightLimits,
  dow: t5697DowDoi.dow,
  doi: t5697DowDoi.doi,
  loadItems: t5697LoadItems,
  positions: ahm.positions.positions,
  fuel: { density: "0.780", takeoffFuel: "87400", tripFuel: "36415", taxiFuel: "600" },
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

/** As printed on the operator's sheet. Comparison evidence, never expected truth. */
export const t5697PrintedLoadsheet = {
  dow: "111293.70",
  doi: "76.31",
  ttl: "7493",
  zfw: "118786.7",
  tow: "206186.7",
  ldw: "169771.7",
  taxiWeight: "206786.7",
  lizfw: "113.79",
  litow: "115.65",
  maczfw: "29",
  mactow: "27.6",
  stab: "3.7",
  underloadBeforeLmc: "52507",
  zfwForwardLimit: "102.4",
  zfwAftLimit: "142.8",
  towForwardLimit: "67.9",
  towAftLimit: "169.3",
} as const;
