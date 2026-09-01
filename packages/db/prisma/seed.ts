/**
 * Faz 4 seed data — IMPLEMENTATION_PLAN.md Faz 4 "SEED" section:
 * aircraft EZ-F429/EZ-F430, stations, one test user per role, and the
 * AhmDocument row for AHM 560 Ed.1/Rev.0.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

const DEV_PASSWORD = "ChangeMe123!";

async function main() {
  const passwordHash = await hash(DEV_PASSWORD);

  await prisma.station.createMany({
    data: [
      { iata: "ASB", icao: "UTAA", name: "Ashgabat", timezone: "Asia/Ashgabat" },
      { iata: "SGN", icao: "VVTS", name: "Ho Chi Minh City (Tan Son Nhat)", timezone: "Asia/Ho_Chi_Minh" },
      { iata: "FRA", icao: "EDDF", name: "Frankfurt", timezone: "Europe/Berlin" },
      { iata: "IST", icao: "LTFM", name: "Istanbul", timezone: "Europe/Istanbul" },
      { iata: "DXB", icao: "OMDB", name: "Dubai", timezone: "Asia/Dubai" },
      { iata: "DEL", icao: "VIDP", name: "Delhi", timezone: "Asia/Kolkata" },
      { iata: "PEK", icao: "ZBAA", name: "Beijing", timezone: "Asia/Shanghai" },
    ],
    skipDuplicates: true,
  });

  const asb = await prisma.station.findUniqueOrThrow({ where: { iata: "ASB" } });

  await prisma.aircraft.createMany({
    data: [
      { registration: "EZ-F429", type: "Airbus A330-243 P2F", ahmDataRef: "a330-243p2f/ed1-rev0" },
      { registration: "EZ-F430", type: "Airbus A330-243 P2F", ahmDataRef: "a330-243p2f/ed1-rev0" },
    ],
    skipDuplicates: true,
  });

  await prisma.ahmDocument.upsert({
    where: {
      aircraftType_edition_revision: { aircraftType: "a330-243p2f", edition: 1, revision: 0 },
    },
    create: {
      aircraftType: "a330-243p2f",
      edition: 1,
      revision: 0,
      effectiveDate: new Date("2023-03-15"),
      dataPath: "a330-243p2f/ed1-rev0",
      approvedBy: "Turkmenistan Airlines OJSC Ground Operations",
    },
    update: {},
  });

  // Dev-only test credentials — one per role, station ASB. Never used
  // outside local/staging seeding; production accounts are created
  // through the app, not this script.
  const users: { email: string; name: string; role: "ADMIN" | "LOAD_CONTROLLER" | "CHECKER" | "RAMP" | "VIEWER" }[] = [
    { email: "admin@tua.local", name: "Admin User", role: "ADMIN" },
    { email: "controller@tua.local", name: "Bezirgen (Load Controller)", role: "LOAD_CONTROLLER" },
    { email: "checker@tua.local", name: "Checker User", role: "CHECKER" },
    { email: "ramp@tua.local", name: "Ramp User", role: "RAMP" },
    { email: "viewer@tua.local", name: "Viewer User", role: "VIEWER" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash, stationId: asb.id },
      update: {},
    });
  }

  // Faz 6 demo flights — T5 692 is the golden test case
  // (docs/AHM560_GROUND_TRUTH.md §19: SGN->ASB, 2026-08-11, EZ-F430).
  // A couple of extra flights/legs give the flights list something real to
  // filter/sort/paginate against in the browser.
  const sgn = await prisma.station.findUniqueOrThrow({ where: { iata: "SGN" } });
  const fra = await prisma.station.findUniqueOrThrow({ where: { iata: "FRA" } });
  const dxb = await prisma.station.findUniqueOrThrow({ where: { iata: "DXB" } });
  const ez429 = await prisma.aircraft.findUniqueOrThrow({ where: { registration: "EZ-F429" } });
  const ez430 = await prisma.aircraft.findUniqueOrThrow({ where: { registration: "EZ-F430" } });

  async function ensureFlight(
    flightNo: string,
    date: Date,
    serviceType: string,
    status: "RESERVED" | "PLANNED" | "LOADING" | "FINALIZED" | "DEPARTED" | "ARRIVED" | "CANCELLED",
    aircraftId: string,
    legs: { seq: number; fromId: string; toId: string; via?: string; stdDep: Date; staArr: Date }[],
  ) {
    const existing = await prisma.flight.findFirst({ where: { flightNo, date } });
    if (existing) return;
    const flight = await prisma.flight.create({ data: { flightNo, date, serviceType, status, aircraftId } });
    for (const leg of legs) {
      await prisma.flightLeg.create({
        data: {
          flightId: flight.id,
          seq: leg.seq,
          via: leg.via,
          fromStationId: leg.fromId,
          toStationId: leg.toId,
          stdDep: leg.stdDep,
          staArr: leg.staArr,
        },
      });
    }
  }

  await ensureFlight("T5 692", new Date("2026-08-11"), "Scheduled intl. non-stop (cargo)", "LOADING", ez430.id, [
    {
      seq: 1,
      fromId: sgn.id,
      toId: asb.id,
      stdDep: new Date("2026-08-11T15:00:00Z"), // 22:00 local SGN (UTC+7)
      staArr: new Date("2026-08-11T21:00:00Z"), // ~02:00 local ASB next day (UTC+5)
    },
  ]);

  await ensureFlight("T5 693", new Date("2026-08-14"), "Scheduled intl. non-stop (cargo)", "RESERVED", ez430.id, [
    {
      seq: 1,
      fromId: asb.id,
      toId: sgn.id,
      stdDep: new Date("2026-08-14T18:00:00Z"),
      staArr: new Date("2026-08-15T02:00:00Z"),
    },
  ]);

  await ensureFlight("T5 700", new Date("2026-08-18"), "Scheduled intl. multi-stop (cargo)", "PLANNED", ez429.id, [
    {
      seq: 1,
      fromId: asb.id,
      toId: dxb.id,
      stdDep: new Date("2026-08-18T04:00:00Z"),
      staArr: new Date("2026-08-18T06:30:00Z"),
    },
    {
      seq: 2,
      fromId: dxb.id,
      toId: fra.id,
      stdDep: new Date("2026-08-18T08:30:00Z"),
      staArr: new Date("2026-08-18T13:00:00Z"),
    },
  ]);

  await ensureFlight("T5 701", new Date("2026-08-20"), "Ferry (no cargo)", "CANCELLED", ez429.id, [
    {
      seq: 1,
      fromId: fra.id,
      toId: asb.id,
      stdDep: new Date("2026-08-20T10:00:00Z"),
      staArr: new Date("2026-08-20T16:00:00Z"),
    },
  ]);

  // Faz 7 demo ULDs — codes follow the IATA convention (3-letter type code
  // + serial + 2-letter owner code) so the naming-convention validator has
  // real examples to check against. Types (PMC/PAG/PZA/PGA/FLA) come from
  // uld-types.json (a330-243p2f/ed1-rev0).
  const t5692 = await prisma.flight.findFirstOrThrow({ where: { flightNo: "T5 692" } });
  const t5700 = await prisma.flight.findFirstOrThrow({ where: { flightNo: "T5 700" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@tua.local" } });

  const ulds: {
    code: string;
    typeCode: string;
    serial: string;
    ownerCode: string;
    status: "AVAILABLE" | "ASSIGNED" | "DAMAGED" | "LOST";
    condition: "SERVICEABLE" | "DAMAGED" | "UNSERVICEABLE";
    baseplateCode?: string;
    assignedStationId: string;
    currentStationId: string;
    currentFlightId?: string;
  }[] = [
    {
      code: "PMC12345TU",
      typeCode: "PMC",
      serial: "12345",
      ownerCode: "TU",
      status: "AVAILABLE",
      condition: "SERVICEABLE",
      baseplateCode: "A1",
      assignedStationId: asb.id,
      currentStationId: asb.id,
    },
    {
      code: "PMC12346TU",
      typeCode: "PMC",
      serial: "12346",
      ownerCode: "TU",
      status: "ASSIGNED",
      condition: "SERVICEABLE",
      baseplateCode: "A1",
      assignedStationId: asb.id,
      currentStationId: sgn.id,
      currentFlightId: t5692.id,
    },
    {
      code: "PAG20011TU",
      typeCode: "PAG",
      serial: "20011",
      ownerCode: "TU",
      status: "AVAILABLE",
      condition: "SERVICEABLE",
      assignedStationId: asb.id,
      currentStationId: asb.id,
    },
    {
      code: "PAG20012TU",
      typeCode: "PAG",
      serial: "20012",
      ownerCode: "TU",
      status: "DAMAGED",
      condition: "DAMAGED",
      assignedStationId: fra.id,
      currentStationId: fra.id,
    },
    {
      code: "PZA30001TU",
      typeCode: "PZA",
      serial: "30001",
      ownerCode: "TU",
      status: "ASSIGNED",
      condition: "SERVICEABLE",
      assignedStationId: asb.id,
      currentStationId: asb.id,
      currentFlightId: t5700.id,
    },
    {
      code: "PGA40001TU",
      typeCode: "PGA",
      serial: "40001",
      ownerCode: "TU",
      status: "LOST",
      condition: "UNSERVICEABLE",
      assignedStationId: sgn.id,
      currentStationId: sgn.id,
    },
    {
      code: "FLA50001TU",
      typeCode: "FLA",
      serial: "50001",
      ownerCode: "TU",
      status: "AVAILABLE",
      condition: "UNSERVICEABLE",
      assignedStationId: asb.id,
      currentStationId: asb.id,
    },
    {
      code: "PMC12399DX",
      typeCode: "PMC",
      serial: "12399",
      ownerCode: "DX",
      status: "AVAILABLE",
      condition: "SERVICEABLE",
      assignedStationId: dxb.id,
      currentStationId: dxb.id,
    },
  ];

  for (const u of ulds) {
    const created = await prisma.uld.upsert({
      where: { code: u.code },
      create: u,
      update: {},
    });

    // A short movement trail for the two ULDs that travelled, so the
    // history view has more than one row to show.
    if (u.code === "PMC12346TU") {
      const existing = await prisma.uldMovement.findFirst({ where: { uldId: created.id } });
      if (!existing) {
        await prisma.uldMovement.create({
          data: { uldId: created.id, stationId: asb.id, note: "Loaded ex-warehouse", recordedById: admin.id },
        });
        await prisma.uldMovement.create({
          data: { uldId: created.id, stationId: sgn.id, flightId: t5692.id, recordedById: admin.id },
        });
      }
    }
  }

  // Faz 13 — demo message addresses so the Messages page isn't empty on first load.
  const messageAddresses: { messageType: "LDM" | "CPM" | "MVT" | "FFM" | "FBL"; label: string; sita: string }[] = [
    { messageType: "LDM", label: "ASB Load Control", sita: "ASBLDT5" },
    { messageType: "CPM", label: "ASB Load Control", sita: "ASBLDT5" },
    { messageType: "MVT", label: "ASB Ops", sita: "ASBOPT5" },
  ];
  for (const addr of messageAddresses) {
    const existing = await prisma.messageAddress.findFirst({ where: { messageType: addr.messageType, sita: addr.sita } });
    if (!existing) {
      await prisma.messageAddress.create({ data: addr });
    }
  }

  console.log("Seed complete:");
  console.log("  7 stations, 2 aircraft, 1 AHM document, 5 users (one per role), 4 demo flights, 8 ULDs.");
  console.log(`  Dev login password for all seeded users: "${DEV_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
