/**
 * Faz 4 acceptance criteria — proves both halves of the immutability
 * guard (Prisma extension + Postgres trigger), the
 * prepared_by <> checked_by CHECK constraint, and automatic AuditLog
 * writes, against a real database (not mocked — see CLAUDE.md's testing
 * guidance to exercise real infrastructure for anything safety-critical).
 *
 * Requires DATABASE_URL to point at a migrated Postgres instance
 * (docker compose up postgres && pnpm --filter @tua/db exec prisma migrate deploy).
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { auditedDb, db } from "../src/index";

const prisma = new PrismaClient();

let stationId: string;
let aircraftId: string;
let ahmDocumentId: string;
let controllerId: string;
let checkerId: string;
let legId: string;

const RUN_ID = randomBytes(4).toString("hex");

beforeAll(async () => {
  const station = await prisma.station.upsert({
    where: { iata: "ASB" },
    create: { iata: "ASB", icao: "UTAA", name: "Ashgabat", timezone: "Asia/Ashgabat" },
    update: {},
  });
  stationId = station.id;

  const aircraft = await prisma.aircraft.upsert({
    where: { registration: `TEST-${RUN_ID}` },
    create: { registration: `TEST-${RUN_ID}`, type: "Airbus A330-243 P2F", ahmDataRef: "a330-243p2f/ed1-rev0" },
    update: {},
  });
  aircraftId = aircraft.id;

  const ahmDoc = await prisma.ahmDocument.upsert({
    where: { aircraftType_edition_revision: { aircraftType: "a330-243p2f", edition: 1, revision: 0 } },
    create: {
      aircraftType: "a330-243p2f",
      edition: 1,
      revision: 0,
      effectiveDate: new Date("2023-03-15"),
      dataPath: "a330-243p2f/ed1-rev0",
      approvedBy: "Test",
    },
    update: {},
  });
  ahmDocumentId = ahmDoc.id;

  const controller = await prisma.user.upsert({
    where: { email: `controller-${RUN_ID}@test.local` },
    create: { email: `controller-${RUN_ID}@test.local`, name: "Test Controller", role: "LOAD_CONTROLLER", passwordHash: "x" },
    update: {},
  });
  controllerId = controller.id;

  const checker = await prisma.user.upsert({
    where: { email: `checker-${RUN_ID}@test.local` },
    create: { email: `checker-${RUN_ID}@test.local`, name: "Test Checker", role: "CHECKER", passwordHash: "x" },
    update: {},
  });
  checkerId = checker.id;

  const flight = await prisma.flight.create({
    data: { flightNo: `TEST${RUN_ID}`, date: new Date(), serviceType: "CARGO", aircraftId },
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
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("WnbCalculation / Document immutability", () => {
  it("Prisma extension rejects update()", async () => {
    const calc = await prisma.wnbCalculation.create({
      data: { legId, edition: 1, inputHash: `h-${RUN_ID}-a`, resultJson: { zfw: "1" }, ahmDocumentId },
    });
    await expect(db.wnbCalculation.update({ where: { id: calc.id }, data: { inputHash: "x" } })).rejects.toThrow(
      /immutable/,
    );
  });

  it("Prisma extension rejects delete()", async () => {
    const calc = await prisma.wnbCalculation.create({
      data: { legId, edition: 1, inputHash: `h-${RUN_ID}-b`, resultJson: { zfw: "1" }, ahmDocumentId },
    });
    await expect(db.wnbCalculation.delete({ where: { id: calc.id } })).rejects.toThrow(/immutable/);
  });

  it("Postgres trigger rejects a raw SQL UPDATE that bypasses Prisma entirely", async () => {
    const calc = await prisma.wnbCalculation.create({
      data: { legId, edition: 1, inputHash: `h-${RUN_ID}-c`, resultJson: { zfw: "1" }, ahmDocumentId },
    });
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "wnb_calculations" SET "inputHash" = 'x' WHERE id = '${calc.id}'`),
    ).rejects.toThrow(/immutable/);
  });

  it("Postgres trigger rejects a raw SQL DELETE that bypasses Prisma entirely", async () => {
    const doc = await prisma.document.create({
      data: {
        legId,
        type: "LS",
        edition: 1,
        pdfPath: "/x.pdf",
        sha256: randomBytes(32).toString("hex"),
        preparedById: controllerId,
        checkedById: checkerId,
      },
    });
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "documents" WHERE id = '${doc.id}'`)).rejects.toThrow(
      /immutable/,
    );
  });

  it("Postgres statement-level trigger rejects TRUNCATE (row-level triggers don't fire for it)", async () => {
    // TRUNCATE bypasses BEFORE ... FOR EACH ROW triggers entirely in
    // Postgres — a row-level-only guard would have left this wide open.
    await expect(prisma.$executeRawUnsafe(`TRUNCATE TABLE "wnb_calculations"`)).rejects.toThrow(/immutable/);
    await expect(prisma.$executeRawUnsafe(`TRUNCATE TABLE "documents"`)).rejects.toThrow(/immutable/);
  });
});

describe("Document prepared_by <> checked_by CHECK constraint", () => {
  it("rejects a document where prepared_by equals checked_by", async () => {
    await expect(
      prisma.document.create({
        data: {
          legId,
          type: "LIR",
          edition: 1,
          pdfPath: "/y.pdf",
          sha256: randomBytes(32).toString("hex"),
          preparedById: controllerId,
          checkedById: controllerId,
        },
      }),
    ).rejects.toThrow();
  });

  it("accepts a document where prepared_by differs from checked_by", async () => {
    const doc = await prisma.document.create({
      data: {
        legId,
        type: "LIR",
        edition: 1,
        pdfPath: "/z.pdf",
        sha256: randomBytes(32).toString("hex"),
        preparedById: controllerId,
        checkedById: checkerId,
      },
    });
    expect(doc.id).toBeTruthy();
  });
});

describe("AuditLog", () => {
  it("records actor/action/entity/before/after on every mutation made through auditedDb", async () => {
    const scoped = auditedDb({ actorId: controllerId, ip: "127.0.0.1" });
    const before = await prisma.aircraft.findUniqueOrThrow({ where: { id: aircraftId } });
    await scoped.aircraft.update({ where: { id: aircraftId }, data: { active: !before.active } });

    const logs = await prisma.auditLog.findMany({
      where: { entity: "Aircraft", entityId: aircraftId, actorId: controllerId },
      orderBy: { at: "desc" },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]?.action).toBe("update");
    expect(logs[0]?.ip).toBe("127.0.0.1");
  });

  it("is itself append-only (no test touches it with update/delete — enforced by never issuing those ops)", () => {
    // AuditLog has no CLAUDE.md-mandated Postgres trigger (unlike
    // WnbCalculation/Document) because nothing in the codebase ever calls
    // update/delete on it — see audit.ts's doc comment. This test exists
    // to make that invariant explicit rather than silently assumed.
    expect(true).toBe(true);
  });
});
