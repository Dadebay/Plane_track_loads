/**
 * The server's contract for a load plan.
 *
 * Everything a client sends is untrusted: the Zod schemas below define the
 * only shape the server accepts, and the `check*` functions re-derive every
 * safety decision from AHM data. No number the client computed — index,
 * %MAC, gross weight, underload — is ever believed or written.
 *
 * Pure and framework-free on purpose (no `next`, no `db` import), so the
 * rules can be tested without a request or a database. `actions.ts` is the
 * thin server-action wrapper that supplies auth, the database and the
 * transaction.
 */

import { Decimal } from "decimal.js";
import { z } from "zod";
import type { LoadPlanAhmData } from "./load-plan-calc";

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------

export type ViolationCode =
  | "cockpitCrewNotSet"
  | "courierCrewNotSet"
  | "grossNotTarePlusNet"
  | "positionNotFound"
  | "positionVariantNotFound"
  | "positionVariantAmbiguous"
  | "uldNotFound"
  | "uldNotServiceable"
  | "uldLost"
  | "uldHeldByAnotherFlight"
  | "uldLoadedTwice"
  | "fuelAllocationInvalid"
  | "automaticRefuelUnavailable"
  | "tripFuelAboveTakeoffFuel"
  | "positionOverload"
  | "positionConflict"
  | "compartmentLimitExceeded"
  | "combinedLoadExceeded"
  | "cgOutOfEnvelope"
  | "calculationFailed"
  | "fuelDistributionRequired";

export interface Violation {
  code: ViolationCode;
  /** The input field the controller has to change, e.g. "items[3].weight". */
  field: string;
  /** English, operational, specific — the brief requires the message to
   * identify the failed rule and the source field. */
  message: string;
}

function violation(code: ViolationCode, field: string, message: string): Violation {
  return { code, field, message };
}

// ---------------------------------------------------------------------------
// Wire schemas
// ---------------------------------------------------------------------------

/**
 * A weight as the client sends it: a plain non-negative decimal string, so
 * it reaches Prisma.Decimal and decimal.js untouched (CLAUDE.md rule #2).
 * Rejects "", "-5", "1,000" (locale separator), "abc" and "1e3".
 */
const weightString = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, "weight must be a non-negative decimal string");

const optionalWeightString = weightString.optional();

export const loadItemSchema = z.object({
  position: z.string().min(1),
  /** GROSS weight. Recomputed from tare + net when both are present. */
  weight: weightString,
  tareWeight: optionalWeightString,
  netWeight: optionalWeightString,
  uldCode: z.string().optional(),
  /** Inventory ULD id, when picked from the ULD list rather than typed. */
  uldId: z.string().optional(),
  awb: z.string().optional(),
  contentCode: z.string().optional(),
  /** Disambiguates a position code AHM 560 publishes in more than one ULD
   * size variant — see LoadItem.uldType in schema.prisma. */
  uldType: z.string().optional(),
});

export const tankAllocationSchema = z.object({
  tank: z.enum(["INNER", "OUTER", "CENTER", "TRIM"]),
  side: z.enum(["LEFT", "RIGHT", "CENTRE"]),
  weight: weightString,
});

export const fuelSchema = z.object({
  density: z.string().min(1),
  takeoffFuel: weightString,
  tripFuel: weightString,
  taxiFuel: weightString,
  refuelMode: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  /** A plan may be saved before the fuel is split across tanks; when rows
   * are present they must sum exactly to the takeoff fuel. */
  allocations: z.array(tankAllocationSchema).default([]),
});

export const saveLoadPlanSchema = z.object({
  legId: z.string().min(1),
  items: z.array(loadItemSchema),
  fuel: fuelSchema,
  // AHM 560 s.6 §III publishes the DOW/DOI matrix for 1-4 cockpit and 0-6
  // courier crew. Outside that there is no cell to look up.
  cockpitCrew: z.number().int().min(1).max(4).nullable(),
  courierCrew: z.number().int().min(0).max(6).nullable(),
  finalize: z.boolean(),
});

export const offloadLoadItemSchema = z.object({
  loadItemId: z.string().min(1),
  reason: z.string().min(1).max(200),
});

export type SaveLoadPlanPayload = z.infer<typeof saveLoadPlanSchema>;
export type LoadItemInput = z.infer<typeof loadItemSchema>;
export type FuelInput = z.infer<typeof fuelSchema>;
export type TankAllocationInput = z.infer<typeof tankAllocationSchema>;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "LOAD_CONTROLLER" | "CHECKER" | "RAMP" | "VIEWER";

/**
 * Who may author a load plan. RAMP and VIEWER read only. CHECKER is
 * deliberately excluded: the checker signs documents and must be a
 * different person from the preparer (CLAUDE.md rule #7), which is only
 * meaningful if they did not write the plan either.
 */
const LOAD_PLAN_WRITE_ROLES: readonly Role[] = ["ADMIN", "LOAD_CONTROLLER"];

export function canEditLoadPlan(role: Role): boolean {
  return LOAD_PLAN_WRITE_ROLES.includes(role);
}

/** Finalization is gated on the same set — a role that cannot build the
 * plan cannot freeze it either. */
export function canFinalizeLoadPlan(role: Role): boolean {
  return canEditLoadPlan(role);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function d(value: string): Decimal {
  return new Decimal(value);
}

export function checkCrewSet(input: { cockpitCrew: number | null; courierCrew: number | null }): Violation[] {
  const violations: Violation[] = [];
  if (input.cockpitCrew === null) {
    violations.push(
      violation("cockpitCrewNotSet", "cockpitCrew", "Cockpit crew count is required before DOW/DOI can be looked up."),
    );
  }
  if (input.courierCrew === null) {
    violations.push(
      violation("courierCrewNotSet", "courierCrew", "Courier crew count is required before DOW/DOI can be looked up."),
    );
  }
  return violations;
}

export interface ResolvedGrossWeights {
  violations: Violation[];
  /** The items with `weight` replaced by the server-derived gross wherever
   * a tare/net breakdown was supplied. */
  resolved: LoadItemInput[];
}

/**
 * Derives gross from tare + net and reports where the client's number
 * disagreed.
 *
 * The derived value wins regardless of the violation: even if the caller
 * chose to save anyway, a client-computed gross must never be what lands in
 * the database. Exact in Decimal, so 0.1 + 0.2 is 0.3 and not 0.30000000004.
 */
export function resolveGrossWeights(items: LoadItemInput[]): ResolvedGrossWeights {
  const violations: Violation[] = [];
  const resolved = items.map((item, index) => {
    if (item.tareWeight === undefined || item.netWeight === undefined) return item;

    const derived = d(item.tareWeight).plus(d(item.netWeight));
    if (!d(item.weight).eq(derived)) {
      violations.push(
        violation(
          "grossNotTarePlusNet",
          `items[${index}].weight`,
          `Position ${item.position}: gross ${item.weight} kg does not equal tare ${item.tareWeight} kg ` +
            `plus net ${item.netWeight} kg (${derived.toString()} kg).`,
        ),
      );
    }
    return { ...item, weight: derived.toString() };
  });
  return { violations, resolved };
}

/**
 * Every position must exist in this AHM revision, and must be unambiguous.
 *
 * A code AHM 560 publishes in two ULD size variants (12P as PALLET_88x125
 * or PALLET_96x125, ABL as SIDE_BY_SIDE_125x88 or _125x96) carries a
 * different maxGross and indexPerKg per variant, so the code alone is not
 * enough to calculate with — the item has to say which one.
 */
export function checkPositionsExist(items: readonly LoadItemInput[], ahmData: LoadPlanAhmData): Violation[] {
  const violations: Violation[] = [];

  items.forEach((item, index) => {
    const matches = ahmData.positions.filter((p) => p.code === item.position);
    if (matches.length === 0) {
      violations.push(
        violation(
          "positionNotFound",
          `items[${index}].position`,
          `Position ${item.position} does not exist in AHM 560 position data.`,
        ),
      );
      return;
    }

    if (item.uldType !== undefined) {
      if (!matches.some((p) => p.uldType === item.uldType)) {
        violations.push(
          violation(
            "positionVariantNotFound",
            `items[${index}].uldType`,
            `Position ${item.position} has no ${item.uldType} variant. ` +
              `Published variants: ${matches.map((p) => p.uldType).join(", ")}.`,
          ),
        );
      }
      return;
    }

    if (matches.length > 1) {
      violations.push(
        violation(
          "positionVariantAmbiguous",
          `items[${index}].uldType`,
          `Position ${item.position} is published in more than one ULD size ` +
            `(${matches.map((p) => p.uldType).join(", ")}) with different limits — pick one.`,
        ),
      );
    }
  });

  return violations;
}

/** What the server knows about a ULD the client wants to load. */
export interface UldEligibility {
  id: string;
  code: string;
  typeCode: string;
  condition: "SERVICEABLE" | "DAMAGED" | "UNSERVICEABLE";
  status: "AVAILABLE" | "ASSIGNED" | "DAMAGED" | "LOST";
  /** Flight the ULD is currently attached to, if any. */
  currentFlightId: string | null;
}

/**
 * Only a serviceable ULD that is free — or already held by this same
 * flight — may be loaded, and never the same one twice.
 *
 * `ulds` is what the database says right now, not what the client claims.
 */
export function checkUldEligibility(
  items: readonly LoadItemInput[],
  ulds: readonly UldEligibility[],
  flightId: string,
): Violation[] {
  const violations: Violation[] = [];
  const byId = new Map(ulds.map((u) => [u.id, u]));
  const seen = new Map<string, number>();

  items.forEach((item, index) => {
    if (item.uldId === undefined) return;

    const previous = seen.get(item.uldId);
    if (previous !== undefined) {
      violations.push(
        violation(
          "uldLoadedTwice",
          `items[${index}].uldId`,
          `The same ULD is loaded at two positions (${items[previous]!.position} and ${item.position}).`,
        ),
      );
      return;
    }
    seen.set(item.uldId, index);

    const uld = byId.get(item.uldId);
    if (!uld) {
      violations.push(
        violation(
          "uldNotFound",
          `items[${index}].uldId`,
          `Position ${item.position} references a ULD that is not in the inventory.`,
        ),
      );
      return;
    }

    if (uld.status === "LOST") {
      violations.push(
        violation("uldLost", `items[${index}].uldId`, `ULD ${uld.code} is recorded as lost and cannot be loaded.`),
      );
      return;
    }

    if (uld.condition !== "SERVICEABLE") {
      violations.push(
        violation(
          "uldNotServiceable",
          `items[${index}].uldId`,
          `ULD ${uld.code} is ${uld.condition.toLowerCase()} and may not be loaded.`,
        ),
      );
      return;
    }

    if (uld.currentFlightId !== null && uld.currentFlightId !== flightId) {
      violations.push(
        violation(
          "uldHeldByAnotherFlight",
          `items[${index}].uldId`,
          `ULD ${uld.code} is currently assigned to another flight.`,
        ),
      );
    }
  });

  return violations;
}

/**
 * The tank distribution must sum exactly to the takeoff fuel, and each row
 * must name a tank/side combination the aircraft actually has. Mirrors
 * wnb-core's validateTankAllocation and the database CHECK constraints, so
 * a rejection reaches the controller as a field message rather than a
 * constraint name.
 *
 * An empty distribution is accepted here: the controller may not have split
 * the fuel yet. Finalization requires it — see `checkFinalizeReady`.
 */
export function checkFuelAllocation(fuel: FuelInput): Violation[] {
  if (fuel.allocations.length === 0) return [];

  const violations: Violation[] = [];
  const seen = new Set<string>();
  let total = new Decimal(0);

  fuel.allocations.forEach((allocation, index) => {
    const key = `${allocation.tank}/${allocation.side}`;
    if (seen.has(key)) {
      violations.push(
        violation("fuelAllocationInvalid", `fuel.allocations[${index}]`, `Tank ${key} is listed more than once.`),
      );
    }
    seen.add(key);

    // AHM 560 Appendix I s.75 footnote (1): INNER and OUTER are per-tank
    // (left/right) columns; CENTER and TRIM are single centreline tanks.
    const paired = allocation.tank === "INNER" || allocation.tank === "OUTER";
    if (paired && allocation.side === "CENTRE") {
      violations.push(
        violation(
          "fuelAllocationInvalid",
          `fuel.allocations[${index}].side`,
          `${allocation.tank} is a left/right pair and needs a side.`,
        ),
      );
    }
    if (!paired && allocation.side !== "CENTRE") {
      violations.push(
        violation(
          "fuelAllocationInvalid",
          `fuel.allocations[${index}].side`,
          `${allocation.tank} sits on the centreline and has no ${allocation.side.toLowerCase()} side.`,
        ),
      );
    }

    total = total.plus(d(allocation.weight));
  });

  const takeoff = d(fuel.takeoffFuel);
  if (!total.eq(takeoff)) {
    const difference = total.minus(takeoff);
    violations.push(
      violation(
        "fuelAllocationInvalid",
        "fuel.allocations",
        `Tank distribution sums to ${total.toString()} kg but takeoff fuel is ${takeoff.toString()} kg ` +
          `(${difference.isPositive() ? "+" : ""}${difference.toString()} kg).`,
      ),
    );
  }

  return violations;
}

/**
 * Automatic refuelling is not selectable: the approved AHM 560 prints what a
 * distribution does to the index (FUEL INDEX PER TANK TABLE) but no rule for
 * producing one. Inventing a fill order would be inventing an operational
 * procedure — see wnb-core's allocateFuelAutomatically and
 * AHM560_ERRATA.md Kayıt 10.
 */
export function checkRefuelMode(fuel: FuelInput): Violation[] {
  if (fuel.refuelMode !== "AUTOMATIC") return [];
  return [
    violation(
      "automaticRefuelUnavailable",
      "fuel.refuelMode",
      "Automatic refuelling is not available: the approved AHM 560 publishes no fuel distribution schedule. " +
        "Enter the tank weights manually.",
    ),
  ];
}

/** Trip fuel is burned out of the takeoff fuel, so it cannot exceed it —
 * a landing weight above the takeoff weight is not a rounding question. */
export function checkFuelConsistency(fuel: FuelInput): Violation[] {
  if (d(fuel.tripFuel).lte(d(fuel.takeoffFuel))) return [];
  return [
    violation(
      "tripFuelAboveTakeoffFuel",
      "fuel.tripFuel",
      `Trip fuel ${fuel.tripFuel} kg is above takeoff fuel ${fuel.takeoffFuel} kg.`,
    ),
  ];
}

/** Rules that only block finalization. A draft may be incomplete; a
 * finalized plan may not. */
export function checkFinalizeReady(fuel: FuelInput, tankFuelDataUsable: boolean): Violation[] {
  if (fuel.allocations.length > 0) return [];

  // Demanding a tank split only makes sense where the AHM can check one.
  // On today's revision it cannot: no refuelling schedule is published and
  // the per-tank index page is untranscribed (AHM560_ERRATA.md Kayıt 10),
  // so `getTankFuelIndex` throws and `allocateFuelAutomatically` reports
  // unavailable. Blocking finalization on a figure nothing consumes stops
  // real flights from being closed out and buys no safety — the controller
  // may still enter the split, and the moment the card arrives and the file
  // stops being provisional this becomes a hard requirement again.
  if (!tankFuelDataUsable) return [];

  return [
    violation(
      "fuelDistributionRequired",
      "fuel.allocations",
      "A finalized plan needs the takeoff fuel distributed across the tanks.",
    ),
  ];
}
