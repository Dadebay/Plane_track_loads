"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, Prisma } from "@tua/db";
import { auth } from "@/auth";
import { getLoadPlanAhmData } from "@/lib/load-plan-ahm";
import { computeLiveWnb, type DraftLoadItem } from "@/lib/load-plan-calc";

const loadItemSchema = z.object({
  position: z.string().min(1),
  weight: z.string().min(1),
  uldCode: z.string().optional(),
  awb: z.string().optional(),
  contentCode: z.string().optional(),
  uldType: z.string().optional(),
});

const fuelSchema = z.object({
  density: z.string().min(1),
  takeoffFuel: z.string().min(1),
  tripFuel: z.string().min(1),
  taxiFuel: z.string().min(1),
});

const saveLoadPlanSchema = z.object({
  legId: z.string().min(1),
  items: z.array(loadItemSchema),
  fuel: fuelSchema,
  cockpitCrew: z.number().int().nullable(),
  courierCrew: z.number().int().nullable(),
  finalize: z.boolean(),
});

export interface SaveLoadPlanInput {
  legId: string;
  items: DraftLoadItem[];
  fuel: z.infer<typeof fuelSchema>;
  cockpitCrew: number | null;
  courierCrew: number | null;
  finalize: boolean;
}

export interface SaveLoadPlanResult {
  ok: boolean;
  error?: string;
  errorDetail?: Record<string, string>;
  version?: number;
}

function inputHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function saveLoadPlan(input: SaveLoadPlanInput): Promise<SaveLoadPlanResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = saveLoadPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  if (data.cockpitCrew === null || data.courierCrew === null) {
    return { ok: false, error: "crewNotSet" };
  }

  const leg = await db.flightLeg.findUnique({
    where: { id: data.legId },
    include: { flight: { include: { aircraft: true } } },
  });
  if (!leg) return { ok: false, error: "notFound" };

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef);

  const result = computeLiveWnb(
    { items: data.items, fuel: data.fuel, cockpitCrew: data.cockpitCrew, courierCrew: data.courierCrew },
    ahmData,
    leg.flight.aircraft.registration,
  );

  if (result.blockingError) {
    return {
      ok: false,
      error: "weightLimitExceeded",
      errorDetail: { message: result.blockingError.message },
    };
  }
  if (!result.allWithinEnvelope || !result.envelope) {
    // Faz 8 kabul kriteri: "Zarf dışına çıkınca kaydetme engellenir".
    const offending = (["zfw", "tow", "ldw"] as const).find((phase) => !result.envelope?.[phase].withinEnvelope);
    return {
      ok: false,
      error: "cgOutOfEnvelope",
      errorDetail: { phase: offending ?? "" },
    };
  }
  if (result.positionOverloads.length > 0) {
    return {
      ok: false,
      error: "positionOverload",
      errorDetail: { position: result.positionOverloads[0]!.position },
    };
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
        loadItems: {
          create: data.items.map((item) => {
            const position = ahmData.positions.find((p) => p.code === item.position);
            return {
              position: item.position,
              uldType: item.uldType ?? null,
              uldCode: item.uldCode ?? null,
              awb: item.awb ?? null,
              weight: new Prisma.Decimal(item.weight),
              contentCode: item.contentCode ?? null,
              deck: position?.deck ?? "MAIN",
            };
          }),
        },
      },
    });

    await tx.fuelRecord.upsert({
      where: { legId: data.legId },
      create: {
        legId: data.legId,
        density: new Prisma.Decimal(data.fuel.density),
        takeoffFuel: new Prisma.Decimal(data.fuel.takeoffFuel),
        tripFuel: new Prisma.Decimal(data.fuel.tripFuel),
        taxiFuel: new Prisma.Decimal(data.fuel.taxiFuel),
      },
      update: {
        density: new Prisma.Decimal(data.fuel.density),
        takeoffFuel: new Prisma.Decimal(data.fuel.takeoffFuel),
        tripFuel: new Prisma.Decimal(data.fuel.tripFuel),
        taxiFuel: new Prisma.Decimal(data.fuel.taxiFuel),
      },
    });

    await tx.wnbCalculation.create({
      data: {
        edition: version,
        inputHash: inputHash(data),
        resultJson: result.wnb as unknown as Prisma.InputJsonValue,
        legId: data.legId,
        ahmDocumentId: ahmData.ahmDocumentId,
      },
    });

    return plan;
  });

  revalidatePath("/[locale]/flights/[id]/load-plan", "page");
  return { ok: true, version: loadPlan.version };
}
