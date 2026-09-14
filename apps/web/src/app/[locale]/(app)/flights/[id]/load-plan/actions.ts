"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db, Prisma } from "@tua/db";
import { auth } from "@/auth";
import { getLoadPlanAhmData } from "@/lib/load-plan-ahm";
import { computeLiveWnb, type DraftLoadItem } from "@/lib/load-plan-calc";
import {
  canEditLoadPlan,
  canFinalizeLoadPlan,
  checkCrewSet,
  checkFinalizeReady,
  checkFuelAllocation,
  checkFuelConsistency,
  checkPositionsExist,
  checkRefuelMode,
  checkUldEligibility,
  offloadLoadItemSchema,
  resolveGrossWeights,
  saveLoadPlanSchema,
  type SaveLoadPlanPayload,
  type UldEligibility,
  type Violation,
} from "@/lib/load-plan-contract";

export type SaveLoadPlanInput = SaveLoadPlanPayload;

export interface SaveLoadPlanResult {
  ok: boolean;
  /** Coarse code the UI branches on. */
  error?: string;
  /** Every failed rule, each naming the field the controller must fix. */
  violations?: Violation[];
  version?: number;
}

function inputHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/**
 * Writes a load plan version.
 *
 * The client sends inputs only. Every weight limit, CG check, position
 * conflict and fuel total is recomputed here from AHM data before anything
 * is written, and the whole write — plan, items, fuel record, tank
 * allocations, immutable calculation and (on finalize) ULD state — happens
 * in one transaction, so an abandoned or rejected save never moves
 * inventory.
 */
export async function saveLoadPlan(input: SaveLoadPlanInput): Promise<SaveLoadPlanResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (!canEditLoadPlan(session.user.role)) return { ok: false, error: "forbidden" };

  // The session is a signed token, so it outlives the row it names: after the
  // database is restored or reseeded the id it carries no longer exists, and
  // every write fails on the load plan's created-by foreign key with nothing
  // on screen to explain it. Check the author up front and say so instead.
  const author = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, active: true } });
  if (!author || !author.active) return { ok: false, error: "sessionStale" };

  const parsed = saveLoadPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      violations: parsed.error.issues.map((issue) => ({
        code: "calculationFailed" as const,
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const data = parsed.data;
  if (data.finalize && !canFinalizeLoadPlan(session.user.role)) return { ok: false, error: "forbidden" };

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: { flight: { include: { aircraft: true } } },
  });
  if (!leg) return { ok: false, error: "notFound" };

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef, leg.flight.aircraft.registration);

  // The client's gross weights are replaced by the server's, derived from
  // tare + net wherever a breakdown was sent. Nothing the client computed
  // is written or believed.
  const { violations: grossViolations, resolved } = resolveGrossWeights(data.items);

  const referencedUldIds = resolved.map((i) => i.uldId).filter((id): id is string => id !== undefined);
  const ulds: UldEligibility[] = referencedUldIds.length
    ? await db.uld.findMany({
        where: { id: { in: referencedUldIds } },
        select: { id: true, code: true, typeCode: true, condition: true, status: true, currentFlightId: true },
      })
    : [];

  // Cheap, input-shaped rules first: a bad position code would make the
  // W&B run throw rather than report.
  const inputViolations: Violation[] = [
    ...grossViolations,
    ...checkCrewSet(data),
    ...checkPositionsExist(resolved, ahmData),
    ...checkUldEligibility(resolved, ulds, leg.flight.id),
    ...checkRefuelMode(data.fuel),
    ...checkFuelConsistency(data.fuel),
    ...checkFuelAllocation(data.fuel),
    ...(data.finalize ? checkFinalizeReady(data.fuel, ahmData.tankFuelDataUsable) : []),
  ];
  if (inputViolations.length > 0) {
    return { ok: false, error: inputViolations[0]!.code, violations: inputViolations };
  }

  // Recompute the whole W&B from the client's inputs — never its numbers.
  const draftItems: DraftLoadItem[] = resolved.map((item) => ({
    position: item.position,
    weight: item.weight,
    uldCode: item.uldCode,
    awb: item.awb,
    contentCode: item.contentCode,
    uldType: item.uldType,
  }));
  const result = computeLiveWnb(
    { items: draftItems, fuel: data.fuel, cockpitCrew: data.cockpitCrew, courierCrew: data.courierCrew },
    ahmData,
    leg.flight.aircraft.registration,
  );

  const computedViolations = collectComputedViolations(result, draftItems);
  if (computedViolations.length > 0) {
    return { ok: false, error: computedViolations[0]!.code, violations: computedViolations };
  }

  const previous = await db.loadPlan.findFirst({ where: { legId: data.legId }, orderBy: { version: "desc" } });
  const version = (previous?.version ?? 0) + 1;

  const loadPlan = await db.$transaction(async (tx) => {
    const plan = await tx.loadPlan.create({
      data: {
        legId: data.legId,
        version,
        status: data.finalize ? "FINALIZED" : "DRAFT",
        createdById: session.user.id,
        cockpitCrew: data.cockpitCrew,
        courierCrew: data.courierCrew,
        // Pins the exact revision this plan was computed against, so the
        // result stays reconstructable after the AHM is superseded.
        ahmDocumentId: ahmData.ahmDocumentId,
        loadItems: {
          create: resolved.map((item) => {
            const position = ahmData.positions.find((p) => p.code === item.position);
            return {
              position: item.position,
              uldType: item.uldType ?? null,
              uldCode: item.uldCode ?? null,
              uldId: item.uldId ?? null,
              awb: item.awb ?? null,
              weight: new Prisma.Decimal(item.weight),
              tareWeight: item.tareWeight ? new Prisma.Decimal(item.tareWeight) : null,
              netWeight: item.netWeight ? new Prisma.Decimal(item.netWeight) : null,
              contentCode: item.contentCode ?? null,
              deck: position?.deck ?? "MAIN",
            };
          }),
        },
      },
    });

    const fuelValues = {
      density: new Prisma.Decimal(data.fuel.density),
      takeoffFuel: new Prisma.Decimal(data.fuel.takeoffFuel),
      tripFuel: new Prisma.Decimal(data.fuel.tripFuel),
      taxiFuel: new Prisma.Decimal(data.fuel.taxiFuel),
      refuelMode: data.fuel.refuelMode,
    };
    const fuelRecord = await tx.fuelRecord.upsert({
      where: { legId: data.legId },
      create: { legId: data.legId, ...fuelValues },
      update: fuelValues,
    });

    // The distribution is replaced wholesale: a tank the client dropped must
    // not survive as a stale row that would silently change the index.
    await tx.fuelTankAllocation.deleteMany({ where: { fuelRecordId: fuelRecord.id } });
    if (data.fuel.allocations.length > 0) {
      await tx.fuelTankAllocation.createMany({
        data: data.fuel.allocations.map((allocation) => ({
          fuelRecordId: fuelRecord.id,
          tank: allocation.tank,
          side: allocation.side,
          weight: new Prisma.Decimal(allocation.weight),
        })),
      });
    }

    await tx.wnbCalculation.create({
      data: {
        edition: version,
        inputHash: inputHash(data),
        // The full input, so this row can be replayed exactly — the result
        // alone is not reconstructable (brief, acceptance criteria).
        inputJson: {
          ...data,
          items: resolved,
          ahm: { documentId: ahmData.ahmDocumentId },
          registration: leg.flight.aircraft.registration,
        } as unknown as Prisma.InputJsonValue,
        resultJson: result.wnb as unknown as Prisma.InputJsonValue,
        legId: data.legId,
        ahmDocumentId: ahmData.ahmDocumentId,
      },
    });

    // Inventory moves only on finalization, and only inside this
    // transaction — an abandoned draft never touches a ULD.
    if (data.finalize && referencedUldIds.length > 0) {
      await tx.uld.updateMany({
        where: { id: { in: referencedUldIds } },
        data: { status: "ASSIGNED", currentFlightId: leg.flight.id },
      });
      await tx.uldMovement.createMany({
        data: referencedUldIds.map((uldId) => ({
          uldId,
          stationId: leg.fromStationId,
          flightId: leg.flight.id,
          note: `Loaded on load plan v${version}`,
          recordedById: session.user.id,
        })),
      });
    }

    return plan;
  });

  revalidatePath("/[locale]/flights/[id]/load-plan", "page");
  return { ok: true, version: loadPlan.version };
}

export interface OffloadResult {
  ok: boolean;
  error?: string;
}

/**
 * Takes a ULD off a position without deleting the record.
 *
 * The brief calls for "a deliberate, audited offload action rather than
 * silently deleting an assigned ULD": the load item stays, marked with who
 * offloaded it and why, and the ULD is released back to the inventory in
 * the same transaction.
 */
export async function offloadLoadItem(input: { loadItemId: string; reason: string }): Promise<OffloadResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (!canEditLoadPlan(session.user.role)) return { ok: false, error: "forbidden" };

  const parsed = offloadLoadItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const item = await db.loadItem.findUnique({
    where: { id: data.loadItemId },
    include: { loadPlan: { include: { leg: true } } },
  });
  if (!item) return { ok: false, error: "notFound" };
  if (item.offloadedAt !== null) return { ok: false, error: "alreadyOffloaded" };
  if (item.loadPlan.status === "FINALIZED") return { ok: false, error: "planFinalized" };

  await db.$transaction(async (tx) => {
    await tx.loadItem.update({
      where: { id: item.id },
      data: {
        offloadedAt: new Date(),
        offloadedById: session.user.id,
        offloadReason: data.reason,
      },
    });

    if (item.uldId) {
      await tx.uld.update({
        where: { id: item.uldId },
        data: { status: "AVAILABLE", currentFlightId: null },
      });
      await tx.uldMovement.create({
        data: {
          uldId: item.uldId,
          stationId: item.loadPlan.leg.fromStationId,
          flightId: item.loadPlan.leg.flightId,
          note: `Offloaded from ${item.position}: ${data.reason}`,
          recordedById: session.user.id,
        },
      });
    }
  });

  revalidatePath("/[locale]/flights/[id]/load-plan", "page");
  return { ok: true };
}

/**
 * The limit checks that only exist after a full server-side W&B run:
 * position overloads, mutually exclusive positions, compartment and
 * combined-load limits, and the CG envelope.
 */
function collectComputedViolations(
  result: ReturnType<typeof computeLiveWnb>,
  items: DraftLoadItem[],
): Violation[] {
  const violations: Violation[] = [];
  const fieldFor = (position: string, suffix: string) => {
    const index = items.findIndex((i) => i.position === position);
    return index >= 0 ? `items[${index}].${suffix}` : "items";
  };

  for (const overload of result.positionOverloads) {
    violations.push({
      code: "positionOverload",
      field: fieldFor(overload.position, "weight"),
      message: `Position ${overload.position} holds ${overload.actual} kg, above its maximum of ${overload.max} kg.`,
    });
  }

  for (const conflict of result.positionConflicts) {
    const code = conflict.a.split("/")[1] ?? "";
    violations.push({
      code: "positionConflict",
      field: fieldFor(code, "position"),
      message: conflict.reason,
    });
  }

  for (const compartment of result.compartments) {
    if (compartment.withinLimit) continue;
    violations.push({
      code: "compartmentLimitExceeded",
      field: "items",
      message: `${compartment.target}: ${compartment.actual} kg exceeds the published maximum of ${compartment.max} kg.`,
    });
  }

  if (result.combinedLoad.available && !result.combinedLoad.check.allWithinLimit) {
    const zone = result.combinedLoad.check.zones.find((z) => !z.withinLimit);
    violations.push({
      code: "combinedLoadExceeded",
      field: "items",
      message:
        `Combined load limit exceeded at zone ${zone?.zone ?? "?"}: cumulative ${zone?.cumulativeLoad ?? "?"} kg ` +
        `above the ${zone?.limit ?? "?"} kg limit for ZFCG band ${result.combinedLoad.check.band}.`,
    });
  }

  if (result.blockingError) {
    violations.push({ code: "calculationFailed", field: "fuel", message: result.blockingError.message });
  } else if (!result.allWithinEnvelope || !result.envelope) {
    const phase = (["zfw", "tow", "ldw"] as const).find((p) => !result.envelope?.[p].withinEnvelope);
    const check = phase ? result.envelope?.[phase] : undefined;
    violations.push({
      code: "cgOutOfEnvelope",
      field: "items",
      message: check
        ? `${check.phase} CG is outside the envelope: index ${check.index} at ${check.weight} kg, ` +
          `limits [${check.forwardLimit}, ${check.aftLimit}].`
        : "CG envelope could not be verified.",
    });
  }

  return violations;
}
