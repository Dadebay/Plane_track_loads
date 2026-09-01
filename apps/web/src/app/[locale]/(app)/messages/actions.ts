"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "decimal.js";
import { z } from "zod";
import { db, Prisma } from "@tua/db";
import {
  encodeLdm,
  encodeCpmDispatch,
  encodeMvt,
  parseCpmAcceptance,
  createQueuedMessage,
  sendWithRetry,
  isDue,
  assertValidAddress,
  type MessageType,
  type MvtEvent,
  type ParsedCpmAcceptance,
  type StationAddress,
} from "@tua/messaging";
import { auth } from "@/auth";
import { getLoadPlanAhmData } from "@/lib/load-plan-ahm";
import { resolvePositions } from "@/lib/load-plan-calc";
import { localOutboxTransport } from "@/lib/message-transport";

export interface MessageActionResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

async function writeAudit(action: string, entityId: string, after: unknown, actorId: string): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      entity: "OutgoingMessage",
      entityId,
      before: Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      actorId,
    },
  });
}

/** Placeholder SITA-shaped address for our own station, until Faz 15
 * decides where real station addressing config lives — not an AHM
 * constant (CLAUDE.md rule #3 doesn't apply; this is organizational
 * addressing, not aircraft/load data). */
function ownStationAddress(iata: string): StationAddress {
  return { sita: `${iata}OPT5` };
}

async function sendAndPersist(
  legId: string,
  messageType: MessageType,
  addressId: string,
  body: string,
  actorId: string,
): Promise<MessageActionResult> {
  const address = await db.messageAddress.findUnique({ where: { id: addressId } });
  if (!address || !address.active) return { ok: false, error: "notFound" };

  const stationAddress: StationAddress = { sita: address.sita ?? undefined, email: address.email ?? undefined };
  try {
    assertValidAddress(stationAddress);
  } catch {
    return { ok: false, error: "invalidAddress" };
  }

  const record = await db.outgoingMessage.create({
    data: {
      messageType,
      body,
      status: "PENDING",
      legId,
      addressId,
      createdById: actorId,
    },
  });

  const queued = createQueuedMessage(record.id, { messageType, address: stationAddress, body });
  const result = await sendWithRetry(localOutboxTransport, queued);

  const updated = await db.outgoingMessage.update({
    where: { id: record.id },
    data: {
      status: result.status,
      attempts: result.attempts,
      lastError: result.lastError,
      nextAttemptAt: result.nextAttemptAt ? new Date(result.nextAttemptAt) : null,
      sentAt: result.status === "SENT" ? new Date() : null,
    },
  });

  await writeAudit("create", updated.id, { messageType, legId, status: updated.status }, actorId);

  revalidatePath("/[locale]/messages", "page");
  return { ok: true, messageId: updated.id };
}

const legAddressSchema = z.object({ legId: z.string().min(1), addressId: z.string().min(1) });

export async function generateLdm(input: z.infer<typeof legAddressSchema>): Promise<MessageActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const parsed = legAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      toStation: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1, include: { loadItems: true } },
    },
  });
  if (!leg) return { ok: false, error: "notFound" };
  const loadPlan = leg.loadPlans[0];
  if (!loadPlan || loadPlan.status !== "FINALIZED") return { ok: false, error: "loadPlanNotFinalized" };

  const wnbCalculation = await db.wnbCalculation.findFirst({
    where: { legId: data.legId, edition: loadPlan.version },
    orderBy: { calculatedAt: "desc" },
  });
  if (!wnbCalculation) return { ok: false, error: "notFound" };
  const wnb = wnbCalculation.resultJson as { ttl: string };

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef);
  const draftItems = loadPlan.loadItems.map((li) => ({ position: li.position, weight: li.weight.toString() }));
  const positions = resolvePositions(ahmData.positions, draftItems);
  const positionByCode = new Map(positions.map((p) => [p.code, p]));

  let mainDeckWeight = new Decimal(0);
  const compartmentTotals = new Map<number, Decimal>();
  for (const item of draftItems) {
    const pos = positionByCode.get(item.position);
    if (!pos) continue;
    if (pos.deck === "MAIN") {
      mainDeckWeight = mainDeckWeight.plus(item.weight);
      continue;
    }
    const m = /^([1-5])/.exec(item.position);
    if (!m) continue;
    const n = Number(m[1]);
    compartmentTotals.set(n, (compartmentTotals.get(n) ?? new Decimal(0)).plus(item.weight));
  }

  const body = encodeLdm({
    flight: {
      flightNo: leg.flight.flightNo.replace(/\s+/g, ""),
      date: leg.flight.date.toISOString().slice(0, 10),
      origin: leg.fromStation.iata,
      destination: leg.toStation.iata,
      aircraftRegistration: leg.flight.aircraft.registration,
    },
    originator: ownStationAddress(leg.fromStation.iata),
    mainDeckWeight: mainDeckWeight.toString(),
    compartments: [...compartmentTotals.entries()]
      .map(([number, weight]) => ({ number, weight: weight.toString() }))
      .sort((a, b) => a.number - b.number),
    totalTrafficLoad: wnb.ttl,
    passengers: 0,
  });

  return sendAndPersist(data.legId, "LDM", data.addressId, body, session.user.id);
}

export async function generateCpm(input: z.infer<typeof legAddressSchema>): Promise<MessageActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const parsed = legAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      toStation: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1, include: { loadItems: true } },
    },
  });
  if (!leg) return { ok: false, error: "notFound" };
  const loadPlan = leg.loadPlans[0];
  if (!loadPlan || loadPlan.status !== "FINALIZED") return { ok: false, error: "loadPlanNotFinalized" };

  const body = encodeCpmDispatch({
    flight: {
      flightNo: leg.flight.flightNo.replace(/\s+/g, ""),
      date: leg.flight.date.toISOString().slice(0, 10),
      origin: leg.fromStation.iata,
      destination: leg.toStation.iata,
      aircraftRegistration: leg.flight.aircraft.registration,
    },
    originator: ownStationAddress(leg.fromStation.iata),
    positions: loadPlan.loadItems.map((li) => ({
      position: li.position,
      uldCode: li.uldCode ?? undefined,
      awb: li.awb ?? undefined,
      weight: li.weight.toString(),
      contentCode: li.contentCode ?? undefined,
    })),
  });

  return sendAndPersist(data.legId, "CPM", data.addressId, body, session.user.id);
}

const movementSchema = z.object({
  legId: z.string().min(1),
  addressId: z.string().min(1),
  event: z.enum(["OFF", "ON", "ARR", "DEP"]),
});

export async function generateMvt(input: z.infer<typeof movementSchema>): Promise<MessageActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: { flight: { include: { aircraft: true } }, fromStation: true, toStation: true },
  });
  if (!leg) return { ok: false, error: "notFound" };

  const now = new Date();
  const event: MvtEvent = data.event;
  await db.flightLeg.update({
    where: { id: data.legId },
    data: event === "OFF" || event === "DEP" ? { atdDep: now } : { ataArr: now },
  });

  const actualTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

  const body = encodeMvt({
    flight: {
      flightNo: leg.flight.flightNo.replace(/\s+/g, ""),
      date: leg.flight.date.toISOString().slice(0, 10),
      origin: leg.fromStation.iata,
      destination: leg.toStation.iata,
      aircraftRegistration: leg.flight.aircraft.registration,
    },
    originator: ownStationAddress(leg.fromStation.iata),
    event,
    actualTime,
    paxOnBoard: 0,
  });

  return sendAndPersist(data.legId, "MVT", data.addressId, body, session.user.id);
}

const retrySchema = z.object({ messageId: z.string().min(1) });

export async function retryMessage(input: z.infer<typeof retrySchema>): Promise<MessageActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const parsed = retrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const record = await db.outgoingMessage.findUnique({
    where: { id: parsed.data.messageId },
    include: { address: true },
  });
  if (!record) return { ok: false, error: "notFound" };
  if (record.status !== "RETRYING" && record.status !== "PENDING" && record.status !== "FAILED") {
    return { ok: false, error: "notRetryable" };
  }

  const stationAddress: StationAddress = {
    sita: record.address.sita ?? undefined,
    email: record.address.email ?? undefined,
  };
  const queued = {
    id: record.id,
    message: { messageType: record.messageType, address: stationAddress, body: record.body },
    status: record.status === "FAILED" ? ("RETRYING" as const) : record.status,
    attempts: record.status === "FAILED" ? 0 : record.attempts,
    lastError: record.lastError,
    createdAt: record.createdAt.toISOString(),
    nextAttemptAt: new Date().toISOString(),
  };
  if (!isDue(queued, new Date())) return { ok: false, error: "notDue" };

  const result = await sendWithRetry(localOutboxTransport, queued);

  const updated = await db.outgoingMessage.update({
    where: { id: record.id },
    data: {
      status: result.status,
      attempts: result.attempts,
      lastError: result.lastError,
      nextAttemptAt: result.nextAttemptAt ? new Date(result.nextAttemptAt) : null,
      sentAt: result.status === "SENT" ? new Date() : record.sentAt,
    },
  });

  await writeAudit("retry", updated.id, { status: updated.status, attempts: updated.attempts }, session.user.id);

  revalidatePath("/[locale]/messages", "page");
  return { ok: true, messageId: updated.id };
}

const addAddressSchema = z.object({
  messageType: z.enum(["LDM", "CPM", "MVT", "FFM", "FBL"]),
  label: z.string().min(1),
  sita: z.string().optional(),
  email: z.string().optional(),
});

export async function createMessageAddress(
  input: z.infer<typeof addAddressSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const parsed = addAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const address: StationAddress = { sita: data.sita || undefined, email: data.email || undefined };
  try {
    assertValidAddress(address);
  } catch {
    return { ok: false, error: "invalidAddress" };
  }

  const created = await db.messageAddress.create({
    data: { messageType: data.messageType, label: data.label, sita: address.sita ?? null, email: address.email ?? null },
  });

  await writeAudit("create", created.id, { messageType: data.messageType, label: data.label }, session.user.id);
  revalidatePath("/[locale]/messages", "page");
  return { ok: true };
}

const parseIncomingSchema = z.object({ text: z.string().min(1) });

export async function parseIncomingCpm(
  input: z.infer<typeof parseIncomingSchema>,
): Promise<{ ok: boolean; error?: string; parsed?: ParsedCpmAcceptance }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const parsed = parseIncomingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = parseCpmAcceptance(parsed.data.text);
    return { ok: true, parsed: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "parseError" };
  }
}
