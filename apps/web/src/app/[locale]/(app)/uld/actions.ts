"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, Prisma } from "@tua/db";
import { auth } from "@/auth";
import { isValidUldCode } from "@/lib/uld-code";

const ULD_STATUSES = ["AVAILABLE", "ASSIGNED", "DAMAGED", "LOST"] as const;
const ULD_CONDITIONS = ["SERVICEABLE", "DAMAGED", "UNSERVICEABLE"] as const;

const uldSchema = z.object({
  code: z.string().refine(isValidUldCode, "invalidCode"),
  typeCode: z.string().min(1, "requiredField"),
  serial: z.string().optional(),
  ownerCode: z.string().optional(),
  status: z.enum(ULD_STATUSES),
  condition: z.enum(ULD_CONDITIONS),
  baseplateCode: z.string().optional(),
  assignedStationId: z.string().min(1, "requiredField"),
  currentStationId: z.string().min(1, "requiredField"),
});

export type UldFormInput = z.infer<typeof uldSchema>;

export interface UldActionResult {
  ok: boolean;
  error?: string;
  uldId?: string;
}

async function writeAudit(
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  actorId: string | undefined,
): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      entity: "Uld",
      entityId,
      before: (before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      actorId: actorId ?? null,
    },
  });
}

export async function createUld(input: UldFormInput): Promise<UldActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = uldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const existing = await db.uld.findUnique({ where: { code: data.code } });
  if (existing) return { ok: false, error: "duplicateCode" };

  const uld = await db.uld.create({
    data: {
      code: data.code,
      typeCode: data.typeCode,
      serial: data.serial || null,
      ownerCode: data.ownerCode || null,
      status: data.status,
      condition: data.condition,
      baseplateCode: data.baseplateCode || null,
      assignedStationId: data.assignedStationId,
      currentStationId: data.currentStationId,
    },
  });

  await writeAudit("create", uld.id, null, { code: data.code }, session.user.id);

  revalidatePath("/[locale]/uld", "page");
  return { ok: true, uldId: uld.id };
}

export async function updateUld(uldId: string, input: UldFormInput): Promise<UldActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = uldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const before = await db.uld.findUnique({ where: { id: uldId } });
  if (!before) return { ok: false, error: "notFound" };

  if (data.code !== before.code) {
    const codeTaken = await db.uld.findUnique({ where: { code: data.code } });
    if (codeTaken) return { ok: false, error: "duplicateCode" };
  }

  await db.uld.update({
    where: { id: uldId },
    data: {
      code: data.code,
      typeCode: data.typeCode,
      serial: data.serial || null,
      ownerCode: data.ownerCode || null,
      status: data.status,
      condition: data.condition,
      baseplateCode: data.baseplateCode || null,
      assignedStationId: data.assignedStationId,
      currentStationId: data.currentStationId,
    },
  });

  await writeAudit(
    "update",
    uldId,
    { code: before.code, status: before.status },
    { code: data.code, status: data.status },
    session.user.id,
  );

  revalidatePath("/[locale]/uld", "page");
  return { ok: true, uldId };
}

export async function deleteUld(uldId: string): Promise<UldActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const before = await db.uld.findUnique({ where: { id: uldId } });
  if (!before) return { ok: false, error: "notFound" };

  await db.uldMovement.deleteMany({ where: { uldId } });
  await db.uld.delete({ where: { id: uldId } });

  await writeAudit("delete", uldId, { code: before.code }, null, session.user.id);

  revalidatePath("/[locale]/uld", "page");
  return { ok: true };
}

const movementSchema = z.object({
  stationId: z.string().min(1, "requiredField"),
  flightId: z.string().optional(),
  note: z.string().optional(),
});

export async function recordUldMovement(
  uldId: string,
  input: z.infer<typeof movementSchema>,
): Promise<UldActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const uld = await db.uld.findUnique({ where: { id: uldId } });
  if (!uld) return { ok: false, error: "notFound" };

  await db.$transaction([
    db.uldMovement.create({
      data: {
        uldId,
        stationId: data.stationId,
        flightId: data.flightId || null,
        note: data.note || null,
        recordedById: session.user.id,
      },
    }),
    db.uld.update({
      where: { id: uldId },
      data: { currentStationId: data.stationId, currentFlightId: data.flightId || null },
    }),
  ]);

  revalidatePath("/[locale]/uld", "page");
  return { ok: true, uldId };
}

export interface UldMovementRow {
  id: string;
  stationIata: string;
  flightNo: string | null;
  note: string | null;
  recordedAt: string;
  recordedByName: string | null;
}

export async function getUldMovements(uldId: string): Promise<UldMovementRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  const movements = await db.uldMovement.findMany({
    where: { uldId },
    include: { station: true, flight: true, recordedBy: true },
    orderBy: { recordedAt: "desc" },
  });

  return movements.map((m) => ({
    id: m.id,
    stationIata: m.station.iata,
    flightNo: m.flight?.flightNo ?? null,
    note: m.note,
    recordedAt: m.recordedAt.toISOString(),
    recordedByName: m.recordedBy?.name ?? null,
  }));
}

export async function bulkUpdateUldStatus(uldIds: string[], status: (typeof ULD_STATUSES)[number]): Promise<UldActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (uldIds.length === 0) return { ok: false, error: "requiredField" };

  await db.uld.updateMany({ where: { id: { in: uldIds } }, data: { status } });
  await writeAudit("bulk-status-update", uldIds.join(","), null, { status, count: uldIds.length }, session.user.id);

  revalidatePath("/[locale]/uld", "page");
  return { ok: true };
}
