"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "decimal.js";
import { z } from "zod";
import { db, Prisma } from "@tua/db";
import { renderEnvPdf, renderLirPdf, renderLoadsheetPdf, type LirCell } from "@tua/documents";
import { checkCompartmentLimits, checkEnvelope, type LmcChange, type Position, type WnbResult } from "@tua/wnb-core";
import { auth } from "@/auth";
import { getLoadPlanAhmData, resolveAhmDocumentForAircraft } from "@/lib/load-plan-ahm";
import { resolvePositions, type DraftLoadItem, type LoadPlanAhmData } from "@/lib/load-plan-calc";
import { getPositionRect } from "@/lib/aircraft-layout";
import { storeDocument } from "@/lib/document-storage";

const generateLirSchema = z.object({
  legId: z.string().min(1),
  checkedById: z.string().min(1),
  specialInformation: z.string().optional(),
});

export interface GenerateLirResult {
  ok: boolean;
  error?: string;
  documentId?: string;
}

async function writeAudit(
  action: string,
  entityId: string,
  after: unknown,
  actorId: string | undefined,
): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      entity: "Document",
      entityId,
      before: Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      actorId: actorId ?? null,
    },
  });
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function formatTime(date: Date): string {
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** CLAUDE.md rule #2 — rounding belongs in the presentation layer. checkEnvelope's
 * forwardLimit/aftLimit come straight out of a CG-table lerp() with full decimal.js
 * precision (by design — wnb-core never rounds internally); the Loadsheet prints them
 * as an index value, so they're rounded here, the same precision as MACZFW/MACTOW. */
function roundIndex(value: string): string {
  return new Decimal(value).toDecimalPlaces(1).toString();
}

/**
 * Faz 12 — Last Minute Changes. A flight's *first* FINALIZED load plan
 * version is the one the original loadsheet was printed against; every
 * later FINALIZED version on the same leg is an LMC on top of it. This
 * diffs the two position-by-position (never touching `wnb.underloadBeforeLmc`
 * itself — that stays the figure computed from the original load, exactly
 * as a real "UNDERLOAD BEFORE LMC" printed field means: calculated *before*
 * any LMC, not recomputed after one).
 */
async function computeLmcContext(
  legId: string,
  currentVersion: number,
  currentItems: { position: string; weight: Prisma.Decimal }[],
): Promise<{ lastMinuteChanges: LmcChange[]; underloadBeforeLmc: string | null }> {
  if (currentVersion <= 1) return { lastMinuteChanges: [], underloadBeforeLmc: null };

  const firstPlan = await db.loadPlan.findFirst({
    where: { legId, status: "FINALIZED" },
    orderBy: { version: "asc" },
    include: { loadItems: true },
  });
  if (!firstPlan || firstPlan.version === currentVersion) return { lastMinuteChanges: [], underloadBeforeLmc: null };

  const baselineCalc = await db.wnbCalculation.findFirst({
    where: { legId, edition: firstPlan.version },
    orderBy: { calculatedAt: "desc" },
  });
  const underloadBeforeLmc = baselineCalc
    ? (baselineCalc.resultJson as unknown as WnbResult).underloadBeforeLmc
    : null;

  const totals = (items: { position: string; weight: Prisma.Decimal }[]) => {
    const byPosition = new Map<string, Decimal>();
    for (const item of items) {
      byPosition.set(item.position, (byPosition.get(item.position) ?? new Decimal(0)).plus(item.weight.toString()));
    }
    return byPosition;
  };
  const before = totals(firstPlan.loadItems);
  const after = totals(currentItems);

  const lastMinuteChanges: LmcChange[] = [];
  for (const position of new Set([...before.keys(), ...after.keys()])) {
    const delta = (after.get(position) ?? new Decimal(0)).minus(before.get(position) ?? new Decimal(0));
    if (!delta.isZero()) {
      lastMinuteChanges.push({ position, weightDelta: delta.toString() });
    }
  }
  lastMinuteChanges.sort((a, b) => a.position.localeCompare(b.position));

  return { lastMinuteChanges, underloadBeforeLmc };
}

/** Shared by generateLir and generateLoadsheet — one cell per AHM position, fwd-to-aft ordered, empty positions carry weight: null. */
function buildCells(ahmData: LoadPlanAhmData, draftItems: DraftLoadItem[], positions: Position[]): LirCell[] {
  const itemByPosition = new Map(draftItems.map((item) => [item.position, item]));

  return positions
    .map((pos) => {
      const item = itemByPosition.get(pos.code);
      const cell: LirCell = {
        code: pos.code,
        deck: pos.deck,
        maxGross: pos.maxGross,
        uldCode: item?.uldCode ?? null,
        awb: item?.awb ?? null,
        weight: item ? item.weight : null,
      };
      return cell;
    })
    .sort((a, b) => {
      const rectA = getPositionRect(a.code, a.deck);
      const rectB = getPositionRect(b.code, b.deck);
      const deckOrder = a.deck === b.deck ? 0 : a.deck === "MAIN" ? -1 : 1;
      if (deckOrder !== 0) return deckOrder;
      return (rectA?.x ?? 0) - (rectB?.x ?? 0);
    });
}

export async function generateLir(input: z.infer<typeof generateLirSchema>): Promise<GenerateLirResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = generateLirSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  // CLAUDE.md rule #7 — prepared_by <> checked_by, enforced here (clear
  // error before hitting the DB CHECK constraint) and by the DB itself.
  if (data.checkedById === session.user.id) {
    return { ok: false, error: "preparedEqualsChecked" };
  }

  const checker = await db.user.findUnique({ where: { id: data.checkedById } });
  if (!checker) return { ok: false, error: "notFound" };

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1, include: { loadItems: true } },
    },
  });
  if (!leg) return { ok: false, error: "notFound" };

  const loadPlan = leg.loadPlans[0];
  if (!loadPlan || loadPlan.status !== "FINALIZED") {
    return { ok: false, error: "loadPlanNotFinalized" };
  }

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef);
  const draftItems = loadPlan.loadItems.map((li) => ({
    position: li.position,
    weight: li.weight.toString(),
    uldCode: li.uldCode ?? undefined,
    awb: li.awb ?? undefined,
    uldType: li.uldType ?? undefined,
  }));
  const positions = resolvePositions(ahmData.positions, draftItems);
  const cells = buildCells(ahmData, draftItems, positions);

  const priorEditions = await db.document.count({ where: { legId: data.legId, type: "LIR" } });
  const edition = priorEditions + 1;

  const pdfBuffer = await renderLirPdf({
    station: leg.fromStation.iata,
    flightNo: leg.flight.flightNo,
    date: formatDate(leg.flight.date),
    aircraftType: leg.flight.aircraft.type,
    registration: leg.flight.aircraft.registration,
    editionNo: String(edition).padStart(2, "0"),
    preparedBy: session.user.name ?? session.user.email ?? "",
    checkedBy: checker.name,
    mainDeckMaxLoad: ahmData.mainDeckMaxLoad,
    compartments: ahmData.compartments.map((c) => ({
      number: c.number,
      description: c.description,
      lirSubLimit: c.lirSubLimit,
    })),
    cells,
    specialInformation: data.specialInformation ?? "",
    watermark: process.env.DOCUMENTS_WATERMARK !== "false",
  });

  const stored = await storeDocument("LIR", data.legId, edition, pdfBuffer);

  const document = await db.document.create({
    data: {
      type: "LIR",
      edition,
      pdfPath: stored.pdfPath,
      sha256: stored.sha256,
      legId: data.legId,
      preparedById: session.user.id,
      checkedById: data.checkedById,
    },
  });

  await writeAudit(
    "create",
    document.id,
    { type: "LIR", edition, legId: data.legId, flightNo: leg.flight.flightNo },
    session.user.id,
  );

  revalidatePath("/[locale]/documents", "page");
  return { ok: true, documentId: document.id };
}

const generateLoadsheetSchema = z.object({
  legId: z.string().min(1),
  checkedById: z.string().min(1),
  specialInformation: z.string().optional(),
});

export async function generateLoadsheet(
  input: z.infer<typeof generateLoadsheetSchema>,
): Promise<GenerateLirResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = generateLoadsheetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  // CLAUDE.md rule #7 — prepared_by <> checked_by, enforced here (clear
  // error before hitting the DB CHECK constraint) and by the DB itself.
  if (data.checkedById === session.user.id) {
    return { ok: false, error: "preparedEqualsChecked" };
  }

  const checker = await db.user.findUnique({ where: { id: data.checkedById } });
  if (!checker) return { ok: false, error: "notFound" };

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      toStation: true,
      fuelRecord: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1, include: { loadItems: true } },
    },
  });
  if (!leg) return { ok: false, error: "notFound" };

  const loadPlan = leg.loadPlans[0];
  if (!loadPlan || loadPlan.status !== "FINALIZED") {
    return { ok: false, error: "loadPlanNotFinalized" };
  }
  if (!leg.fuelRecord) return { ok: false, error: "notFound" };
  if (loadPlan.cockpitCrew === null || loadPlan.courierCrew === null) {
    return { ok: false, error: "notFound" };
  }

  const wnbCalculation = await db.wnbCalculation.findFirst({
    where: { legId: data.legId, edition: loadPlan.version },
    orderBy: { calculatedAt: "desc" },
  });
  if (!wnbCalculation) return { ok: false, error: "notFound" };
  const wnb = wnbCalculation.resultJson as unknown as WnbResult;

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef);
  const ahmDocument = await resolveAhmDocumentForAircraft(leg.flight.aircraft.ahmDataRef);
  const draftItems = loadPlan.loadItems.map((li) => ({
    position: li.position,
    weight: li.weight.toString(),
    uldCode: li.uldCode ?? undefined,
    awb: li.awb ?? undefined,
    uldType: li.uldType ?? undefined,
  }));
  const positions = resolvePositions(ahmData.positions, draftItems);
  const cells = buildCells(ahmData, draftItems, positions);
  const compartments = checkCompartmentLimits(draftItems, positions, ahmData.compartments, ahmData.mainDeckMaxLoad);

  const zfwEnvelope = checkEnvelope(wnb.zfw, wnb.lizfw, "ZFW", ahmData.cgLimits.zfw);
  const towEnvelope = checkEnvelope(wnb.tow, wnb.litow, "TOW", ahmData.cgLimits.takeoff);

  const lmc = await computeLmcContext(data.legId, loadPlan.version, loadPlan.loadItems);

  const priorEditions = await db.document.count({ where: { legId: data.legId, type: "LS" } });
  const edition = priorEditions + 1;

  const pdfBuffer = await renderLoadsheetPdf({
    station: leg.fromStation.iata,
    destination: leg.toStation.iata,
    flightNo: leg.flight.flightNo,
    date: formatDate(leg.stdDep),
    time: formatTime(leg.stdDep),
    aircraftType: leg.flight.aircraft.type,
    registration: leg.flight.aircraft.registration,
    version: "",
    cockpitCrew: loadPlan.cockpitCrew,
    courierCrew: loadPlan.courierCrew,
    editionNo: String(edition).padStart(2, "0"),
    preparedBy: session.user.name ?? session.user.email ?? "",
    checkedBy: checker.name,

    ahmEdition: ahmDocument.edition,
    ahmRevision: ahmDocument.revision,

    dow: wnb.dow,
    doi: wnb.doi,
    fuelDensity: leg.fuelRecord.density.toString(),

    passengerCount: 0,
    cabinBagWeight: "0",

    ttl: wnb.ttl,
    zfw: wnb.zfw,
    mzfw: ahmData.weightLimits.mzfw,
    takeoffFuel: leg.fuelRecord.takeoffFuel.toString(),
    tow: wnb.tow,
    mtow: ahmData.weightLimits.mtow,
    tripFuel: leg.fuelRecord.tripFuel.toString(),
    ldw: wnb.ldw,
    mlw: ahmData.weightLimits.mlw,
    taxiFuel: leg.fuelRecord.taxiFuel.toString(),
    taxiWeight: wnb.taxiWeight,
    mtw: ahmData.weightLimits.mtw,

    underloadBeforeLmc: lmc.underloadBeforeLmc ?? wnb.underloadBeforeLmc,

    lizfw: wnb.lizfw,
    litow: wnb.litow,
    lilaw: wnb.lilaw,
    maczfw: wnb.maczfw,
    mactow: wnb.mactow,
    maclaw: wnb.maclaw,
    stab: wnb.stab,

    zfwForwardLimit: roundIndex(zfwEnvelope.forwardLimit),
    zfwAftLimit: roundIndex(zfwEnvelope.aftLimit),
    towForwardLimit: roundIndex(towEnvelope.forwardLimit),
    towAftLimit: roundIndex(towEnvelope.aftLimit),

    compartments,
    cells,

    lastMinuteChanges: lmc.lastMinuteChanges,

    specialInformation: data.specialInformation ?? "",
    watermark: process.env.DOCUMENTS_WATERMARK !== "false",
  });

  const stored = await storeDocument("LS", data.legId, edition, pdfBuffer);

  const document = await db.document.create({
    data: {
      type: "LS",
      edition,
      pdfPath: stored.pdfPath,
      sha256: stored.sha256,
      legId: data.legId,
      preparedById: session.user.id,
      checkedById: data.checkedById,
    },
  });

  await writeAudit(
    "create",
    document.id,
    { type: "LS", edition, legId: data.legId, flightNo: leg.flight.flightNo },
    session.user.id,
  );

  revalidatePath("/[locale]/documents", "page");
  return { ok: true, documentId: document.id };
}

const generateEnvSchema = z.object({
  legId: z.string().min(1),
  checkedById: z.string().min(1),
  specialInformation: z.string().optional(),
});

export async function generateEnv(input: z.infer<typeof generateEnvSchema>): Promise<GenerateLirResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = generateEnvSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  // CLAUDE.md rule #7 — prepared_by <> checked_by, enforced here (clear
  // error before hitting the DB CHECK constraint) and by the DB itself.
  if (data.checkedById === session.user.id) {
    return { ok: false, error: "preparedEqualsChecked" };
  }

  const checker = await db.user.findUnique({ where: { id: data.checkedById } });
  if (!checker) return { ok: false, error: "notFound" };

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!leg) return { ok: false, error: "notFound" };

  const loadPlan = leg.loadPlans[0];
  if (!loadPlan || loadPlan.status !== "FINALIZED") {
    return { ok: false, error: "loadPlanNotFinalized" };
  }

  const wnbCalculation = await db.wnbCalculation.findFirst({
    where: { legId: data.legId, edition: loadPlan.version },
    orderBy: { calculatedAt: "desc" },
  });
  if (!wnbCalculation) return { ok: false, error: "notFound" };
  const wnb = wnbCalculation.resultJson as unknown as WnbResult;

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef);

  const zfwEnvelope = checkEnvelope(wnb.zfw, wnb.lizfw, "ZFW", ahmData.cgLimits.zfw);
  const towEnvelope = checkEnvelope(wnb.tow, wnb.litow, "TOW", ahmData.cgLimits.takeoff);

  const priorEditions = await db.document.count({ where: { legId: data.legId, type: "ENV" } });
  const edition = priorEditions + 1;

  const pdfBuffer = await renderEnvPdf({
    station: leg.fromStation.iata,
    flightNo: leg.flight.flightNo,
    date: formatDate(leg.flight.date),
    aircraftType: leg.flight.aircraft.type,
    registration: leg.flight.aircraft.registration,
    editionNo: String(edition).padStart(2, "0"),
    preparedBy: session.user.name ?? session.user.email ?? "",
    checkedBy: checker.name,

    zfwLimits: ahmData.cgLimits.zfw,
    takeoffLimits: ahmData.cgLimits.takeoff,
    mlw: ahmData.weightLimits.mlw,
    minWeight: ahmData.weightLimits.min,

    zfcg: { weight: wnb.zfw, index: wnb.lizfw, withinEnvelope: zfwEnvelope.withinEnvelope },
    tocg: { weight: wnb.tow, index: wnb.litow, withinEnvelope: towEnvelope.withinEnvelope },
    zfcgCorrected: null,

    watermark: process.env.DOCUMENTS_WATERMARK !== "false",
  });

  const stored = await storeDocument("ENV", data.legId, edition, pdfBuffer);

  const document = await db.document.create({
    data: {
      type: "ENV",
      edition,
      pdfPath: stored.pdfPath,
      sha256: stored.sha256,
      legId: data.legId,
      preparedById: session.user.id,
      checkedById: data.checkedById,
    },
  });

  await writeAudit(
    "create",
    document.id,
    { type: "ENV", edition, legId: data.legId, flightNo: leg.flight.flightNo },
    session.user.id,
  );

  revalidatePath("/[locale]/documents", "page");
  return { ok: true, documentId: document.id };
}
