import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type {
  ImbalanceCheck,
  LateralImbalanceLimits,
  LateralImbalanceRow,
  LoadItem,
  Position,
  PositionConfiguration,
  SideBySideCategory,
} from "./types";

/**
 * AHM 560 Appendix I s.74 — LATERAL IMBALANCE CAUTION
 * (FOR SIDE-BY-SIDE PALLETS ONLY).
 *
 * The plate's arithmetic, exactly as printed:
 *
 *   per payload row   (weight LEFT - weight RIGHT) x Y-ARM  = lateral moment
 *   per fuel tank pair                 LEFT - RIGHT          = lateral moment
 *   total without margin               sum of the above
 *   operational margin                 a fixed 11 554 kg.m, carrying the sign
 *                                      of the total without it
 *   total including margin             must lie within +/- 34 000 kg.m
 *
 * The margin taking the total's own sign is the plate's printed rule, not an
 * interpretation: "SIGN OF OPERATIONAL MARGIN IS IDENTICAL TO SIGN OF TOTAL
 * IMBALANCE WITHOUT OPERATIONAL MARGIN". It therefore always makes the result
 * worse, never better.
 *
 * Single-row and bridge positions are centred and contribute nothing — the
 * plate's own title restricts the check to side-by-side pallets.
 *
 * ## Why this can still report NOT_AVAILABLE
 *
 * The fuel rows read their moments from FUEL LATERAL MOMENT PER TANK TABLE on
 * page 3 of the same plate. The only copy of that page we hold is a ~174 ppi
 * scan in which 6 and 8 are not separable at the printed one-decimal
 * precision, so no fuel value has been transcribed (AHM560_ERRATA.md Kayıt
 * 10). Without the fuel term there is no total, and claiming one from the
 * payload half alone would understate the imbalance. The payload rows are
 * still returned, clearly marked as informational, so a controller can see
 * the asymmetry they are building — but the check itself stays unavailable
 * until `fuelDataAvailable` is set by real data.
 */

export interface SideBySideLoad {
  category: SideBySideCategory;
  leftWeight: string;
  rightWeight: string;
}

export interface FuelLateralMoment {
  tank: "OUTER" | "INNER";
  leftMoment: string;
  rightMoment: string;
}

export interface LateralImbalanceInput {
  sideBySide: SideBySideLoad[];
  /** Per tank pair, from the plate's page 3. Omit while that page is
   * untranscribed — `limits.fuelDataAvailable` must then be false. */
  fuel?: FuelLateralMoment[];
  /** From lateral-imbalance.json. `null` for a revision whose plate we do
   * not hold, which is itself a reason the check cannot run. */
  limits: LateralImbalanceLimits | null;
}

const UNAVAILABLE_NO_LIMITS =
  "Lateral imbalance limits are not loaded for this AHM revision — no limit data to check against.";

const UNAVAILABLE_NO_FUEL =
  "FUEL LATERAL MOMENT PER TANK TABLE (AHM 560 Appendix I s.75) is not transcribed: the approved scan " +
  "cannot be read reliably at the printed precision — see AHM560_ERRATA.md Kayıt 10. The payload half " +
  "below is provisional and informational only; a total lateral imbalance cannot be stated without the " +
  "fuel term.";

function payloadRows(loads: SideBySideLoad[], limits: LateralImbalanceLimits): LateralImbalanceRow[] {
  const yArmByCategory = new Map(limits.payload.map((p) => [p.category, p.yArm]));

  return loads.map((load) => {
    const yArm = yArmByCategory.get(load.category);
    if (yArm === undefined) {
      throw new Error(`no printed Y-arm for side-by-side category ${load.category}`);
    }
    const difference = d(load.leftWeight).minus(d(load.rightWeight));
    return {
      category: load.category,
      leftWeight: load.leftWeight,
      rightWeight: load.rightWeight,
      difference: difference.toString(),
      yArm,
      moment: difference.times(d(yArm)).toString(),
    };
  });
}

function sum(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0));
}

export function checkLateralImbalance(input: LateralImbalanceInput): ImbalanceCheck {
  const { limits } = input;
  if (limits === null) {
    return { status: "NOT_AVAILABLE", reason: UNAVAILABLE_NO_LIMITS };
  }

  const rows = payloadRows(input.sideBySide, limits);
  const payloadMoment = sum(rows.map((r) => d(r.moment)));

  if (!limits.fuelDataAvailable) {
    return {
      status: "NOT_AVAILABLE",
      reason: UNAVAILABLE_NO_FUEL,
      payloadRows: rows,
      payloadMoment: payloadMoment.toString(),
    };
  }

  const fuelMoment = sum((input.fuel ?? []).map((f) => d(f.leftMoment).minus(d(f.rightMoment))));
  const totalWithoutMargin = payloadMoment.plus(fuelMoment);

  // The margin carries the total's sign. At exactly zero imbalance there is
  // no sign to follow and no asymmetry to pad, so the margin is zero.
  const margin = d(limits.operationalMargin).abs().times(totalWithoutMargin.isZero() ? 0 : totalWithoutMargin.s);
  const totalWithMargin = totalWithoutMargin.plus(margin);
  const limit = d(limits.limit).abs();
  const exceeded = totalWithMargin.abs().gt(limit);

  return {
    status: exceeded ? "EXCEEDED" : "OK",
    detail:
      `Lateral imbalance ${totalWithMargin.toDecimalPlaces(1).toString()} kg.m ` +
      `(payload ${payloadMoment.toDecimalPlaces(1).toString()}, fuel ${fuelMoment.toDecimalPlaces(1).toString()}, ` +
      `operational margin ${margin.toDecimalPlaces(1).toString()}) against a limit of ` +
      `+/- ${limit.toString()} kg.m`,
    payloadRows: rows,
    payloadMoment: payloadMoment.toString(),
    fuelMoment: fuelMoment.toString(),
    totalWithoutMargin: totalWithoutMargin.toString(),
    operationalMargin: margin.toString(),
    totalWithMargin: totalWithMargin.toString(),
    limit: limit.toString(),
  };
}

/**
 * Groups loaded side-by-side positions into the three categories the plate
 * prints, so `checkLateralImbalance` can be fed straight from a load plan.
 *
 * A position counts only when its configuration is laterally paired and its
 * code ends in L or R — which is exactly the plate's "side-by-side pallets
 * only" scope. Lower-deck half containers map to LOWER LD3.
 */
export function collectSideBySideLoads(
  loadItems: LoadItem[],
  positions: Position[],
  configurations: PositionConfiguration[],
): SideBySideLoad[] {
  const byId = new Map(configurations.map((c) => [c.id, c]));
  const positionByCode = new Map<string, Position>();
  for (const position of positions) {
    // Half-container codes ("11L") are not in the position data; they inherit
    // the parent position's configuration, so index by both.
    positionByCode.set(position.code, position);
  }

  const totals = new Map<SideBySideCategory, { left: Decimal; right: Decimal }>();
  const bump = (category: SideBySideCategory, side: "left" | "right", weight: Decimal) => {
    const entry = totals.get(category) ?? { left: new Decimal(0), right: new Decimal(0) };
    entry[side] = entry[side].plus(weight);
    totals.set(category, entry);
  };

  for (const item of loadItems) {
    const suffix = item.position.slice(-1);
    if (suffix !== "L" && suffix !== "R") continue;

    const position = positionByCode.get(item.position) ?? positionByCode.get(item.position.slice(0, -1));
    if (!position) continue;
    const configuration = byId.get(position.uldType);
    if (!configuration || configuration.lateralPlacement === "CENTRE") continue;

    const category = categoryFor(position.deck, configuration.id);
    if (category === null) continue;
    bump(category, suffix === "L" ? "left" : "right", d(item.weight));
  }

  const order: SideBySideCategory[] = ["MAIN_SBS_88", "MAIN_SBS_96", "LOWER_LD3"];
  return order
    .filter((category) => totals.has(category))
    .map((category) => {
      const entry = totals.get(category)!;
      return {
        category,
        leftWeight: entry.left.toString(),
        rightWeight: entry.right.toString(),
      };
    });
}

function categoryFor(deck: Position["deck"], configurationId: string): SideBySideCategory | null {
  if (deck === "LOWER") return "LOWER_LD3";
  // The plate labels the main-deck rows by the pallet's lateral width: a
  // "SIDE BY SIDE 125\" x 88\"" pallet is 88" across, hence MAIN SBS 88".
  if (configurationId === "SIDE_BY_SIDE_125x88") return "MAIN_SBS_88";
  if (configurationId === "SIDE_BY_SIDE_125x96") return "MAIN_SBS_96";
  return null;
}
