import { Decimal } from "decimal.js";
import { d, roundHalfUp } from "./decimal-utils";
import { PositionNotFoundError, WeightLimitExceededError } from "./errors";
import { getFuelIndex } from "./fuel";
import { indexToMac, macToStab } from "./formula";
import { calculateUnderload } from "./underload";
import type { LoadItem, Position, WnbInput, WnbResult } from "./types";

const WEIGHT_DECIMALS = 1;
const INDEX_DECIMALS = 2;
const MAC_DECIMALS = 1;

function totalWeight(items: LoadItem[]): Decimal {
  return items.reduce((acc, item) => acc.plus(d(item.weight)), new Decimal(0));
}

// AHM 560 s.57-67 §10 — deadload index = sum of each item's weight times
// its position's published index-per-kg. This is additive because
// index-per-kg is already (arm - Ref.Sta)/C for that position (AHM 560
// s.15 §3.1); K is only added once, via DOI.
function deadloadIndex(items: LoadItem[], positions: Map<string, Position>): Decimal {
  let total = new Decimal(0);
  for (const item of items) {
    const pos = positions.get(item.position);
    if (!pos) throw new PositionNotFoundError(item.position);
    total = total.plus(d(item.weight).times(d(pos.indexPerKg)));
  }
  return total;
}

/**
 * AHM 560 §3-6 — full weight & balance calculation for one leg.
 *
 * Computes TTL/ZFW/TOW/LDW, LIZFW/LITOW/LILAW, MACZFW/MACTOW/MACLAW, STAB,
 * and UNDERLOAD BEFORE LMC (Bulgu #1 fix — see underload.ts), from DOW/DOI,
 * the load list, and fuel state. All index math is additive on the AHM
 * Index scale (see `deadloadIndex` above); MAC values are derived from the
 * final index via the s.15-16 %MAC formula.
 *
 * NOTE (GROUND_TRUTH.md — new finding, see docs/AHM560_ERRATA.md): running
 * the T5 692 golden case's 33 load items through this exact AHM 560
 * Ed.1/Rev.0 methodology does not reproduce the real loadsheet's printed
 * LIZFW (106.07) or fuel index contribution (3.32) — this function
 * computes ~104.97 and ~3.77 respectively from the AHM data we have. This
 * mirrors GROUND_TRUTH.md Bulgu #2's DOW/DOI mismatch and most likely has
 * the same root cause: the AHM 560 revision actually used to produce the
 * real LS_T5692 PDF is not Ed.1/Rev.0. See golden-t5692.test.ts for the
 * two-part verification this implies (formula correctness vs. AHM Ed.1/
 * Rev.0 data reconciliation).
 *
 * Throws WeightLimitExceededError if MZFW/MTOW/MLW/MTW is exceeded —
 * CG envelope violations are reported (not thrown) via `checkEnvelope`,
 * which the caller should invoke separately with the returned ZFW/TOW/LDW
 * and LIZFW/LITOW/LILAW before treating a calculation as final.
 */
export function calculateWnb(input: WnbInput): WnbResult {
  const positionByCode = new Map(input.positions.map((p) => [p.code, p]));

  const ttl = totalWeight(input.loadItems);
  const dow = d(input.dow);
  const zfw = dow.plus(ttl);

  const takeoffFuel = d(input.fuel.takeoffFuel);
  const tripFuel = d(input.fuel.tripFuel);
  const taxiFuel = d(input.fuel.taxiFuel);

  const tow = zfw.plus(takeoffFuel);
  const ldw = tow.minus(tripFuel);
  const taxiWeight = tow.plus(taxiFuel);
  const landingFuel = takeoffFuel.minus(tripFuel);

  if (zfw.gt(d(input.weightLimits.mzfw))) {
    throw new WeightLimitExceededError("MZFW", zfw.toString(), input.weightLimits.mzfw);
  }
  if (tow.gt(d(input.weightLimits.mtow))) {
    throw new WeightLimitExceededError("MTOW", tow.toString(), input.weightLimits.mtow);
  }
  if (ldw.gt(d(input.weightLimits.mlw))) {
    throw new WeightLimitExceededError("MLW", ldw.toString(), input.weightLimits.mlw);
  }
  if (taxiWeight.gt(d(input.weightLimits.mtw))) {
    throw new WeightLimitExceededError("MTW", taxiWeight.toString(), input.weightLimits.mtw);
  }

  const doi = d(input.doi);
  const deadload = deadloadIndex(input.loadItems, positionByCode);
  const lizfw = doi.plus(deadload);

  const takeoffFuelIndex = getFuelIndex(input.fuel.takeoffFuel, input.fuel.density, input.fuelIndexTable);
  const landingFuelIndex = getFuelIndex(landingFuel.toString(), input.fuel.density, input.fuelIndexTable);

  const litow = lizfw.plus(takeoffFuelIndex);
  const lilaw = lizfw.plus(landingFuelIndex);

  const maczfw = roundHalfUp(indexToMac(lizfw.toString(), zfw.toString(), input.indexFormula), MAC_DECIMALS);
  const mactow = roundHalfUp(indexToMac(litow.toString(), tow.toString(), input.indexFormula), MAC_DECIMALS);
  const maclaw = roundHalfUp(indexToMac(lilaw.toString(), ldw.toString(), input.indexFormula), MAC_DECIMALS);

  const stab = macToStab(mactow.toString(), input.stabCurve, input.stabRounding);

  const underloadBeforeLmc = calculateUnderload(zfw.toString(), tow.toString(), ldw.toString(), input.weightLimits);

  return {
    ttl: ttl.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    zfw: zfw.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    tow: tow.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    ldw: ldw.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    taxiWeight: taxiWeight.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    dow: dow.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    doi: doi.toDecimalPlaces(INDEX_DECIMALS).toString(),
    lizfw: lizfw.toDecimalPlaces(INDEX_DECIMALS).toString(),
    litow: litow.toDecimalPlaces(INDEX_DECIMALS).toString(),
    lilaw: lilaw.toDecimalPlaces(INDEX_DECIMALS).toString(),
    maczfw: maczfw.toString(),
    mactow: mactow.toString(),
    maclaw: maclaw.toString(),
    stab: { value: stab.value.toString(), direction: stab.direction },
    underloadBeforeLmc: underloadBeforeLmc.toDecimalPlaces(WEIGHT_DECIMALS).toString(),
    fuelIndex: {
      takeoff: takeoffFuelIndex.toDecimalPlaces(INDEX_DECIMALS).toString(),
      trip: landingFuelIndex.toDecimalPlaces(INDEX_DECIMALS).toString(),
    },
  };
}
