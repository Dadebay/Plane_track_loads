import { Decimal } from "decimal.js";
import { d, lerp } from "./decimal-utils";
import { WnbError } from "./errors";
import type { FuelTankIndexTable, FuelTankName, TankAllocation, TankAllocationCheck } from "./types";

/**
 * AHM 560 Appendix I s.75 — FUEL INDEX PER TANK TABLE.
 *
 * Tank-by-tank fuel distribution: which tank holds how much, what that does
 * to the index, and whether the distribution is admissible at all.
 *
 * ## What this module deliberately does not do
 *
 * **It does not distribute fuel automatically.** The approved AHM prints
 * per-tank index and lateral moment tables but no refuelling schedule — no
 * fill order, no tank priority, no trapped-fuel rule. Inventing one would be
 * inventing an operational procedure, which is worse than inventing a
 * constant. `allocateFuelAutomatically` therefore reports why it cannot run
 * rather than guessing (CLAUDE.md rule #3, brief: "stop and ask for
 * authoritative input").
 *
 * **It refuses to read a provisional table.** The only copy of the plate's
 * page 3 we hold is a ~174 ppi scan where 6 and 8 are not separable, so
 * `fuel-tank-index.json` carries `provisional: true` and every lookup here
 * throws `ProvisionalAhmDataError` while it does. See AHM560_ERRATA.md
 * Kayıt 10. The validation half below needs no table and works today.
 */

/** Thrown when a calculation is asked to read AHM data that is still flagged
 * provisional — an unverified constant must never reach a result. */
export class ProvisionalAhmDataError extends WnbError {
  constructor(
    public readonly table: string,
    public readonly reference: string,
  ) {
    super(
      `${table} is flagged provisional and cannot be used in a calculation — see ${reference}. ` +
        `A legible copy of the source page is required first.`,
    );
  }
}

const TANK_INDEX_TABLE = "FUEL INDEX PER TANK TABLE (AHM 560 Appendix I s.75)";
const ERRATA_REF = "AHM560_ERRATA.md Kayıt 10";

/** The paired tanks: a left one and a right one of the same name. CENTER and
 * TRIM are single tanks on the aircraft centreline. */
export const PAIRED_TANKS: readonly FuelTankName[] = ["INNER", "OUTER"];
export const CENTRELINE_TANKS: readonly FuelTankName[] = ["CENTER", "TRIM"];

/**
 * Validates a manual tank allocation against the fuel total the loadsheet
 * will use.
 *
 * The sum must equal the total **exactly**: these are Decimal strings all the
 * way from the input form, so there is no float drift to absorb and a
 * near-miss is a real data error, not rounding (CLAUDE.md rule #2).
 *
 * Reports rather than throws — a controller typing into six tank fields is
 * transiently out of balance on almost every keystroke, and the UI needs to
 * show the running difference, not an exception. Blocking finalization on
 * `balanced === false` is the server's job.
 *
 * `capacities` is optional and, today, unavailable: per-tank capacity comes
 * from the same provisional table. Pass it only once that table is verified.
 */
export function validateTankAllocation(
  allocations: TankAllocation[],
  totalFuel: string,
  capacities?: { tank: FuelTankName; side: TankAllocation["side"]; capacity: string }[],
): TankAllocationCheck {
  const errors: string[] = [];
  const total = d(totalFuel);

  if (total.isNegative()) {
    errors.push(`total fuel ${totalFuel} kg is negative`);
  }

  const seen = new Set<string>();
  let allocated = new Decimal(0);

  for (const allocation of allocations) {
    const key = `${allocation.tank}/${allocation.side}`;
    if (seen.has(key)) {
      errors.push(`tank ${key} appears more than once in the allocation`);
    }
    seen.add(key);

    const weight = d(allocation.weight);
    if (weight.isNegative()) {
      errors.push(`tank ${key} holds a negative weight (${allocation.weight} kg)`);
    }
    if (CENTRELINE_TANKS.includes(allocation.tank) && allocation.side !== "CENTRE") {
      errors.push(`tank ${allocation.tank} is on the centreline and has no ${allocation.side} side`);
    }
    if (PAIRED_TANKS.includes(allocation.tank) && allocation.side === "CENTRE") {
      errors.push(`tank ${allocation.tank} is a left/right pair and needs a side`);
    }
    allocated = allocated.plus(weight);
  }

  for (const limit of capacities ?? []) {
    const allocation = allocations.find((a) => a.tank === limit.tank && a.side === limit.side);
    if (allocation && d(allocation.weight).gt(d(limit.capacity))) {
      errors.push(
        `tank ${limit.tank}/${limit.side} holds ${allocation.weight} kg, above its capacity of ${limit.capacity} kg`,
      );
    }
  }

  const difference = allocated.minus(total);
  if (!difference.isZero()) {
    errors.push(
      `tank allocation sums to ${allocated.toString()} kg but the fuel total is ${total.toString()} kg ` +
        `(${difference.isPositive() ? "+" : ""}${difference.toString()} kg)`,
    );
  }

  const asymmetry = PAIRED_TANKS.map((tank) => {
    const left = allocations.find((a) => a.tank === tank && a.side === "LEFT");
    const right = allocations.find((a) => a.tank === tank && a.side === "RIGHT");
    return {
      tank,
      difference: d(left?.weight ?? "0")
        .minus(d(right?.weight ?? "0"))
        .toString(),
    };
  }).filter((entry) => allocations.some((a) => a.tank === entry.tank));

  return {
    total: total.toString(),
    allocated: allocated.toString(),
    difference: difference.toString(),
    balanced: difference.isZero() && errors.length === 0,
    errors,
    asymmetry,
  };
}

export type AutomaticAllocationResult =
  | { available: true; allocations: TankAllocation[] }
  | { available: false; reason: string };

/**
 * Automatic (schedule-driven) fuel distribution.
 *
 * The approved AHM 560 does not publish one. Its Appendix I plate carries the
 * per-tank index and lateral moment tables — what a given distribution does —
 * but no rule for producing a distribution. Until operations supplies the
 * aircraft's refuelling schedule this stays unavailable; a plausible-looking
 * fill order would be an invented operational procedure.
 */
export function allocateFuelAutomatically(_totalFuel: string, _density: string): AutomaticAllocationResult {
  return {
    available: false,
    reason:
      "The approved AHM 560 publishes no automatic fuel distribution schedule — Appendix I s.75 prints " +
      "what a distribution does to the index, not how to produce one. Manual allocation with " +
      "validateTankAllocation() is the only supported path until operations supplies the refuelling schedule.",
  };
}

/**
 * Index contribution of one tank at a given weight and density, by linear
 * interpolation within the printed column.
 *
 * Throws `ProvisionalAhmDataError` while the table is flagged provisional,
 * which it is today. The interpolation itself is finished and tested against
 * a synthetic verified table, so clearing the flag is the only step left.
 */
export function getTankFuelIndex(
  tank: FuelTankName,
  fuelWeight: string,
  density: string,
  table: FuelTankIndexTable,
): Decimal {
  if (table.provisional) {
    throw new ProvisionalAhmDataError(TANK_INDEX_TABLE, ERRATA_REF);
  }

  const column = table.tanks[tank];
  if (!column) {
    throw new Error(`no ${tank} column in the fuel index per tank table`);
  }
  const rows = column.step[density];
  if (!rows || rows.length === 0) {
    throw new Error(`no ${tank} column for density ${density} in the fuel index per tank table`);
  }

  const weight = d(fuelWeight);
  const points = rows
    .map((r) => ({ weight: d(r.fuelWeight), index: d(r.index) }))
    .sort((a, b) => a.weight.comparedTo(b.weight));

  const first = points[0]!;
  const last = points[points.length - 1]!;

  // An empty tank contributes nothing; the printed column simply starts at
  // its first step. Above the last printed row the tank is full, and the
  // plate's own FULL row is the only defined value — never extrapolate.
  if (weight.isZero()) return new Decimal(0);
  if (weight.lt(first.weight)) {
    return lerp(weight, new Decimal(0), new Decimal(0), first.weight, first.index);
  }
  if (weight.gt(last.weight)) {
    const full = column.full[density];
    if (full === undefined) {
      throw new Error(`no FULL row for ${tank} at density ${density}`);
    }
    return d(full);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (weight.gte(a.weight) && weight.lte(b.weight)) {
      if (weight.eq(a.weight)) return a.index;
      if (weight.eq(b.weight)) return b.index;
      return lerp(weight, a.weight, a.index, b.weight, b.index);
    }
  }

  throw new Error(`could not bracket ${fuelWeight} kg in the ${tank} column at density ${density}`);
}

/**
 * Total index contribution of a full tank allocation. INNER and OUTER values
 * are printed per tank (the plate's footnote 1), so each side is looked up
 * separately and the two are added.
 */
export function getTankAllocationIndex(
  allocations: TankAllocation[],
  density: string,
  table: FuelTankIndexTable,
): Decimal {
  return allocations.reduce(
    (acc, allocation) => acc.plus(getTankFuelIndex(allocation.tank, allocation.weight, density, table)),
    new Decimal(0),
  );
}
