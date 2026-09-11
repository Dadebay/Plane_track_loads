/**
 * Faz 2 (T5 477 parity brief, Aşama 4) — proves the persistence layer added
 * for tare/net/gross, tank allocations and reconstructable operating inputs
 * against a real database, the same way immutability.test.ts does.
 *
 * Requires DATABASE_URL to point at a migrated Postgres instance
 * (docker compose up postgres && pnpm --filter @tua/db exec prisma migrate deploy).
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUN_ID = randomBytes(4).toString("hex");

let stationId: string;
let ahmDocumentId: string;
let controllerId: string;
let legId: string;
let uldId: string;

beforeAll(async () => {
  const station = await prisma.station.upsert({
    where: { iata: "ASB" },
    create: { iata: "ASB", icao: "UTAA", name: "Ashgabat", timezone: "Asia/Ashgabat" },
    update: {},
  });
  stationId = station.id;

  const aircraft = await prisma.aircraft.upsert({
    where: { registration: `PERS-${RUN_ID}` },
    create: { registration: `PERS-${RUN_ID}`, type: "Airbus A330-243 P2F", ahmDataRef: "a330-243p2f/ed1-rev2" },
    update: {},
  });

  const ahmDoc = await prisma.ahmDocument.upsert({
    where: { aircraftType_edition_revision: { aircraftType: "a330-243p2f", edition: 1, revision: 2 } },
    create: {
      aircraftType: "a330-243p2f",
      edition: 1,
      revision: 2,
      effectiveDate: new Date("2025-06-10"),
      dataPath: "a330-243p2f/ed1-rev2",
      approvedBy: "Test",
    },
    update: {},
  });
  ahmDocumentId = ahmDoc.id;

  const controller = await prisma.user.upsert({
    where: { email: `pers-controller-${RUN_ID}@test.local` },
    create: {
      email: `pers-controller-${RUN_ID}@test.local`,
      name: "Test Controller",
      role: "LOAD_CONTROLLER",
      passwordHash: "x",
    },
    update: {},
  });
  controllerId = controller.id;

  const flight = await prisma.flight.create({
    data: { flightNo: `PERS${RUN_ID}`, date: new Date(), serviceType: "CARGO", aircraftId: aircraft.id },
  });
  const leg = await prisma.flightLeg.create({
    data: {
      flightId: flight.id,
      seq: 1,
      fromStationId: stationId,
      toStationId: stationId,
      stdDep: new Date(),
      staArr: new Date(),
    },
  });
  legId = leg.id;

  const uld = await prisma.uld.create({
    data: { code: `PMC${RUN_ID}TK`, typeCode: "PMC", currentStationId: stationId },
  });
  uldId = uld.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function newPlan(version: number) {
  return prisma.loadPlan.create({
    data: { legId, version, createdById: controllerId, ahmDocumentId, cockpitCrew: 2, courierCrew: 3 },
  });
}

let planSeq = 1000;
function nextVersion(): number {
  planSeq += 1;
  return planSeq;
}

describe("LoadItem tare / net / gross", () => {
  it("stores the breakdown and keeps gross as the weight W&B consumes", async () => {
    const plan = await newPlan(nextVersion());
    const item = await prisma.loadItem.create({
      data: {
        loadPlanId: plan.id,
        position: "ABL",
        uldType: "SIDE_BY_SIDE_125x88",
        deck: "MAIN",
        weight: "1120.0",
        tareWeight: "120.0",
        netWeight: "1000.0",
        uldId,
      },
    });
    expect(item.weight.toString()).toBe("1120");
    expect(item.tareWeight?.toString()).toBe("120");
    expect(item.netWeight?.toString()).toBe("1000");
    expect(item.uldId).toBe(uldId);
  });

  it("rejects a gross weight that is not tare plus net", async () => {
    const plan = await newPlan(nextVersion());
    await expect(
      prisma.loadItem.create({
        data: {
          loadPlanId: plan.id,
          position: "ABR",
          deck: "MAIN",
          weight: "1200.0",
          tareWeight: "120.0",
          netWeight: "1000.0",
        },
      }),
    ).rejects.toThrow(/load_items_gross_is_tare_plus_net/);
  });

  it("allows gross alone, for loose load with no ULD", async () => {
    const plan = await newPlan(nextVersion());
    const item = await prisma.loadItem.create({
      data: { loadPlanId: plan.id, position: "52", deck: "LOWER", weight: "340.0" },
    });
    expect(item.tareWeight).toBeNull();
    expect(item.netWeight).toBeNull();
  });

  it("rejects a negative tare or net", async () => {
    const plan = await newPlan(nextVersion());
    await expect(
      prisma.loadItem.create({
        data: {
          loadPlanId: plan.id,
          position: "A",
          deck: "MAIN",
          weight: "880.0",
          tareWeight: "-120.0",
          netWeight: "1000.0",
        },
      }),
    ).rejects.toThrow(/load_items_weights_non_negative/);
  });

  it("is exact at one decimal, where a float sum would drift", async () => {
    const plan = await newPlan(nextVersion());
    const item = await prisma.loadItem.create({
      data: {
        loadPlanId: plan.id,
        position: "B",
        deck: "MAIN",
        weight: "0.3",
        tareWeight: "0.1",
        netWeight: "0.2",
      },
    });
    expect(item.weight.toString()).toBe("0.3");
  });
});

describe("LoadItem offload", () => {
  it("records who offloaded and when, instead of deleting the row", async () => {
    const plan = await newPlan(nextVersion());
    const item = await prisma.loadItem.create({
      data: { loadPlanId: plan.id, position: "C", deck: "MAIN", weight: "500.0", uldId },
    });
    const offloaded = await prisma.loadItem.update({
      where: { id: item.id },
      data: { offloadedAt: new Date(), offloadedById: controllerId, offloadReason: "NOT_READY" },
    });
    expect(offloaded.offloadedById).toBe(controllerId);
    expect(offloaded.offloadedAt).not.toBeNull();
    // The row survives: the plan keeps the record that this ULD was here.
    expect(await prisma.loadItem.findUnique({ where: { id: item.id } })).not.toBeNull();
  });

  it("rejects an offload with no one attributed to it", async () => {
    const plan = await newPlan(nextVersion());
    const item = await prisma.loadItem.create({
      data: { loadPlanId: plan.id, position: "D", deck: "MAIN", weight: "500.0" },
    });
    await expect(
      prisma.loadItem.update({ where: { id: item.id }, data: { offloadedAt: new Date() } }),
    ).rejects.toThrow(/load_items_offload_is_attributed/);
  });
});

describe("FuelTankAllocation", () => {
  async function newFuelRecord() {
    const flight = await prisma.flight.create({
      data: {
        flightNo: `FUEL${randomBytes(3).toString("hex")}`,
        date: new Date(),
        serviceType: "CARGO",
        aircraftId: (await prisma.aircraft.findFirstOrThrow({ where: { registration: `PERS-${RUN_ID}` } })).id,
      },
    });
    const leg = await prisma.flightLeg.create({
      data: {
        flightId: flight.id,
        seq: 1,
        fromStationId: stationId,
        toStationId: stationId,
        stdDep: new Date(),
        staArr: new Date(),
      },
    });
    return prisma.fuelRecord.create({
      data: { legId: leg.id, density: "0.780", takeoffFuel: "61400.0", tripFuel: "36972.0", taxiFuel: "600.0" },
    });
  }

  it("defaults to manual, because no automatic schedule is published", async () => {
    const record = await newFuelRecord();
    expect(record.refuelMode).toBe("MANUAL");
  });

  it("stores a six-row distribution that sums to the takeoff fuel", async () => {
    const record = await newFuelRecord();
    await prisma.fuelTankAllocation.createMany({
      data: [
        { fuelRecordId: record.id, tank: "INNER", side: "LEFT", weight: "20000.0" },
        { fuelRecordId: record.id, tank: "INNER", side: "RIGHT", weight: "20000.0" },
        { fuelRecordId: record.id, tank: "OUTER", side: "LEFT", weight: "2500.0" },
        { fuelRecordId: record.id, tank: "OUTER", side: "RIGHT", weight: "2500.0" },
        { fuelRecordId: record.id, tank: "CENTER", side: "CENTRE", weight: "15000.0" },
        { fuelRecordId: record.id, tank: "TRIM", side: "CENTRE", weight: "1400.0" },
      ],
    });
    const stored = await prisma.fuelRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: { allocations: true },
    });
    const sum = stored.allocations.reduce((acc, a) => acc + Number(a.weight), 0);
    expect(stored.allocations).toHaveLength(6);
    expect(sum).toBe(Number(stored.takeoffFuel));
  });

  it("rejects a second row for the same tank and side", async () => {
    const record = await newFuelRecord();
    await prisma.fuelTankAllocation.create({
      data: { fuelRecordId: record.id, tank: "CENTER", side: "CENTRE", weight: "100.0" },
    });
    await expect(
      prisma.fuelTankAllocation.create({
        data: { fuelRecordId: record.id, tank: "CENTER", side: "CENTRE", weight: "200.0" },
      }),
    ).rejects.toThrow();
  });

  it("rejects a side on a centreline tank and a centreline side on a paired tank", async () => {
    const record = await newFuelRecord();
    await expect(
      prisma.fuelTankAllocation.create({
        data: { fuelRecordId: record.id, tank: "TRIM", side: "LEFT", weight: "100.0" },
      }),
    ).rejects.toThrow(/fuel_tank_allocations_side_matches_tank/);
    await expect(
      prisma.fuelTankAllocation.create({
        data: { fuelRecordId: record.id, tank: "INNER", side: "CENTRE", weight: "100.0" },
      }),
    ).rejects.toThrow(/fuel_tank_allocations_side_matches_tank/);
  });

  it("rejects a negative tank weight", async () => {
    const record = await newFuelRecord();
    await expect(
      prisma.fuelTankAllocation.create({
        data: { fuelRecordId: record.id, tank: "CENTER", side: "CENTRE", weight: "-1.0" },
      }),
    ).rejects.toThrow(/fuel_tank_allocations_weight_non_negative/);
  });
});

describe("reconstructability", () => {
  it("pins the AHM edition/revision on the plan itself", async () => {
    const plan = await prisma.loadPlan.findFirstOrThrow({
      where: { legId, ahmDocumentId: { not: null } },
      include: { ahmDocument: true },
    });
    expect(plan.ahmDocument?.edition).toBe(1);
    expect(plan.ahmDocument?.revision).toBe(2);
  });

  it("stores the full input alongside the result, and both stay immutable", async () => {
    const inputJson = {
      dow: "111294",
      doi: "76.29",
      cockpitCrew: 2,
      courierCrew: 3,
      loadItems: [{ position: "ABL", weight: "1120.0", tareWeight: "120.0", netWeight: "1000.0" }],
      fuel: { density: "0.780", takeoffFuel: "61400.0", allocations: [{ tank: "CENTER", side: "CENTRE", weight: "61400.0" }] },
      ahm: { edition: 1, revision: 2 },
    };
    const calc = await prisma.wnbCalculation.create({
      data: { legId, edition: 1, inputHash: `pers-${RUN_ID}`, inputJson, resultJson: { zfw: "155134.7" }, ahmDocumentId },
    });
    expect(calc.inputJson).toEqual(inputJson);
    // CLAUDE.md rule #5 still holds for the widened row.
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "wnb_calculations" SET "inputJson" = '{}' WHERE id = '${calc.id}'`),
    ).rejects.toThrow(/immutable/);
  });
});
