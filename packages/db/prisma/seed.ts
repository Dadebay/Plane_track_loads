/**
 * Faz 4 seed data — IMPLEMENTATION_PLAN.md Faz 4 "SEED" section:
 * aircraft EZ-F429/EZ-F430, stations, one test user per role, and the
 * AhmDocument row for AHM 560 Ed.1/Rev.0.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

const DEV_PASSWORD = "changeme123";

/** Placeholder for an aircraft whose type has not been supplied yet. Kept
 * explicit so it is greppable and obviously not a real type designation. */
const AIRCRAFT_TYPE_UNKNOWN = "Not specified";

async function main() {
  const passwordHash = await hash(DEV_PASSWORD);

  // City/country feed the station picker's second line. Kept to airports the
  // schedule actually uses — a worldwide airport list is a data-sourcing
  // decision, not something to invent here.
  const stations = [
    { iata: "ASB", icao: "UTAA", name: "Ashgabat", timezone: "Asia/Ashgabat", city: "Ashgabat", country: "Turkmenistan" },
    { iata: "SGN", icao: "VVTS", name: "Tan Son Nhat", timezone: "Asia/Ho_Chi_Minh", city: "Ho Chi Minh City", country: "Vietnam" },
    { iata: "FRA", icao: "EDDF", name: "Frankfurt am Main", timezone: "Europe/Berlin", city: "Frankfurt", country: "Germany" },
    { iata: "IST", icao: "LTFM", name: "Istanbul", timezone: "Europe/Istanbul", city: "Istanbul", country: "Turkey" },
    { iata: "DXB", icao: "OMDB", name: "Dubai Intl", timezone: "Asia/Dubai", city: "Dubai", country: "United Arab Emirates" },
    { iata: "DEL", icao: "VIDP", name: "Indira Gandhi Intl", timezone: "Asia/Kolkata", city: "Delhi", country: "India" },
    { iata: "PEK", icao: "ZBAA", name: "Beijing Capital Intl", timezone: "Asia/Shanghai", city: "Beijing", country: "China" },
    { iata: "MXP", icao: "LIMC", name: "Milano Malpensa", timezone: "Europe/Rome", city: "Milan", country: "Italy" },
    { iata: "SZX", icao: "ZGSZ", name: "Shenzhen Bao'an Intl", timezone: "Asia/Shanghai", city: "Shenzhen", country: "China" },
    { iata: "URC", icao: "ZWWW", name: "Urumqi Diwopu Intl", timezone: "Asia/Urumqi", city: "Urumqi", country: "China" },
    { iata: "HAN", icao: "VVNB", name: "Noi Bai Intl", timezone: "Asia/Ho_Chi_Minh", city: "Hanoi", country: "Vietnam" },
  ];

  for (const station of stations) {
    await prisma.station.upsert({
      where: { iata: station.iata },
      create: station,
      // Re-seeding backfills city/country onto rows created before those
      // columns existed.
      update: station,
    });
  }

  const asb = await prisma.station.findUniqueOrThrow({ where: { iata: "ASB" } });

  // The two freighters we hold approved AHM 560 data for. These are the only
  // registrations a load plan can be calculated for today.
  //
  // iataTypeCode is the code the operator's own flight list prints for these
  // two registrations. Display only — never a calculation input.
  const wnbCapableAircraft = [
    { registration: "EZ-F429", type: "Airbus A330-243 P2F", iataTypeCode: "332", ahmDataRef: "a330-243p2f/ed1-rev2" },
    { registration: "EZ-F430", type: "Airbus A330-243 P2F", iataTypeCode: "332", ahmDataRef: "a330-243p2f/ed1-rev2" },
  ];

  // The rest of the fleet, so the flight list can filter by any registration
  // the crew knows. Their aircraft type is deliberately left as
  // AIRCRAFT_TYPE_UNKNOWN and ahmDataRef empty: guessing a type or an AHM
  // reference for an aircraft we hold no approved data for is exactly the
  // kind of invention CLAUDE.md forbids, and W&B would then run against the
  // wrong aircraft. resolveAhmDocumentForAircraft refuses an empty ref, so a
  // load plan for one of these fails with a clear message instead of
  // silently using someone else's numbers.
  const fleetWithoutAhm = [
    "EZ-A004", "EZ-A005", "EZ-A006", "EZ-A008", "EZ-A009",
    "EZ-A015", "EZ-A016", "EZ-A017", "EZ-A018", "EZ-A020",
    "EZ-A778", "EZ-A779", "EZ-A780", "EZ-A781", "EZ-A782",
    "EZ-F426", "EZ-F427", "EZ-F428",
  ];

  for (const aircraft of wnbCapableAircraft) {
    await prisma.aircraft.upsert({
      where: { registration: aircraft.registration },
      create: aircraft,
      update: aircraft,
    });
  }

  for (const registration of fleetWithoutAhm) {
    await prisma.aircraft.upsert({
      where: { registration },
      create: { registration, type: AIRCRAFT_TYPE_UNKNOWN, ahmDataRef: "" },
      // Never overwrite a type someone has since filled in by hand.
      update: {},
    });
  }

  // Both AHM revisions are seeded. resolveAhmDocumentForAircraft picks the
  // highest edition/revision, so Rev.2 is what new load plans calculate
  // against; Rev.0 stays for /admin/ahm/diff and for reproducing any
  // calculation already recorded against it (WnbCalculation is INSERT-only).
  const ahmRevisions = [
    { revision: 0, effectiveDate: "2023-03-15", dataPath: "a330-243p2f/ed1-rev0" },
    { revision: 2, effectiveDate: "2025-06-10", dataPath: "a330-243p2f/ed1-rev2" },
  ];

  for (const rev of ahmRevisions) {
    await prisma.ahmDocument.upsert({
      where: {
        aircraftType_edition_revision: { aircraftType: "a330-243p2f", edition: 1, revision: rev.revision },
      },
      create: {
        aircraftType: "a330-243p2f",
        edition: 1,
        revision: rev.revision,
        effectiveDate: new Date(rev.effectiveDate),
        dataPath: rev.dataPath,
        approvedBy: "Turkmenistan Airlines OJSC Ground Operations",
      },
      update: {},
    });
  }

  // Dev-only test credentials — one per role, station ASB. Never used
  // outside local/staging seeding; production accounts are created
  // through the app, not this script.
  const users: { email: string; name: string; role: "ADMIN" | "LOAD_CONTROLLER" | "CHECKER" | "RAMP" | "VIEWER" }[] = [
    { email: "admin@gmail.com", name: "Admin User", role: "ADMIN" },
    { email: "controller@tua.local", name: "Bezirgen (Load Controller)", role: "LOAD_CONTROLLER" },
    { email: "checker@tua.local", name: "Checker User", role: "CHECKER" },
    { email: "ramp@tua.local", name: "Ramp User", role: "RAMP" },
    { email: "viewer@tua.local", name: "Viewer User", role: "VIEWER" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash, stationId: asb.id },
      // Re-seeding refreshes the password hash. With `update: {}` a changed
      // DEV_PASSWORD silently did nothing for an already-seeded database,
      // which reads as "the new credentials don't work".
      update: { name: u.name, role: u.role, passwordHash, active: true },
    });
  }

  // The admin account was renamed from admin@tua.local. Deactivate the old
  // row rather than deleting it: it may already be referenced by a load
  // plan, a document or a ULD movement, and those references are what make
  // an audit trail an audit trail. `authorize()` refuses an inactive user,
  // so the stale credentials stop working either way.
  await prisma.user.updateMany({ where: { email: "admin@tua.local" }, data: { active: false } });

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
    legs: { seq: number; fromId: string; toId: string; via?: string; stdDep: Date; etdDep?: Date; atdDep?: Date; staArr: Date }[],
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
          // A leg's estimate starts as its schedule and is revised from
          // there; a blank ETD would read as "no estimate exists", which is
          // not what an unrevised leg means.
          etdDep: leg.etdDep ?? leg.stdDep,
          atdDep: leg.atdDep,
          staArr: leg.staArr,
        },
      });
    }
  }

  // The 10/09/2026 out-and-back day out of ASB, as the crew's own schedule
  // prints it. Local departure times are converted to UTC here; the UI
  // converts them back in each station's own zone.
  const urc = await prisma.station.findUniqueOrThrow({ where: { iata: "URC" } });
  const han = await prisma.station.findUniqueOrThrow({ where: { iata: "HAN" } });
  const szx = await prisma.station.findUniqueOrThrow({ where: { iata: "SZX" } });

  await ensureFlight("T5 3431", new Date("2026-09-10"), "Scheduled intl. non-stop (cargo)", "RESERVED", ez430.id, [
    {
      seq: 1,
      fromId: asb.id,
      toId: urc.id,
      stdDep: new Date("2026-09-10T00:40:00Z"), // 05:40 local ASB (UTC+5)
      staArr: new Date("2026-09-10T06:00:00Z"), // 12:00 local URC (UTC+6)
    },
  ]);

  await ensureFlight("T5 697", new Date("2026-09-10"), "Scheduled intl. non-stop (cargo)", "RESERVED", ez430.id, [
    {
      seq: 1,
      fromId: asb.id,
      toId: han.id,
      stdDep: new Date("2026-09-10T01:55:00Z"), // 06:55 local ASB
      staArr: new Date("2026-09-10T08:55:00Z"), // 15:55 local HAN (UTC+7)
    },
  ]);

  await ensureFlight("T5 619", new Date("2026-09-10"), "Scheduled intl. non-stop (cargo)", "RESERVED", ez429.id, [
    {
      seq: 1,
      fromId: asb.id,
      toId: szx.id,
      stdDep: new Date("2026-09-10T11:00:00Z"), // 16:00 local ASB
      staArr: new Date("2026-09-10T19:20:00Z"), // 03:20 local SZX next day (UTC+8)
    },
  ]);


  // ---------------------------------------------------------------------
  // Four flights that actually operated, rebuilt from the operator's own
  // printed loadsheets (docs/AHM560_GROUND_TRUTH.md §20). Unlike the three
  // scheduled demo flights above these arrive with their real load already
  // in place, so the load-plan page can be opened and finalized straight
  // away and the resulting PDFs put next to the operator's originals.
  //
  // Seeded as DRAFT: the numbers are the load as flown, but the calculation
  // and the documents are ours to produce, not transcribed.
  // ---------------------------------------------------------------------
  const mxp = await prisma.station.findUniqueOrThrow({ where: { iata: "MXP" } });
  const controller = await prisma.user.findUniqueOrThrow({ where: { email: "controller@tua.local" } });
  const ahmRev2 = await prisma.ahmDocument.findFirstOrThrow({
    where: { aircraftType: "a330-243p2f", edition: 1, revision: 2 },
  });

  /** Position codes AHM 560 lists at more than one ULD size. The printed
   * recap gives only the code, so the pallet variant is pinned the same way
   * the golden case pins it — 96"x125" throughout. */
  const PALLET_96_CODES = new Set(["12P", "13P", "21P", "22P", "31P", "32P", "41P", "42P"]);
  const SIDE_BY_SIDE_CODES = /^[A-Z]{2,3}[LR]$/;

  function seedLoadItem(position: string, weight: string) {
    const lower = /^\d/.test(position);
    let uldType: string | null = null;
    if (PALLET_96_CODES.has(position)) uldType = "PALLET_96x125";
    else if (SIDE_BY_SIDE_CODES.test(position)) uldType = "SIDE_BY_SIDE_125x96";
    return { position, weight, uldType, deck: lower ? ("LOWER" as const) : ("MAIN" as const) };
  }

  async function ensureFlownFlight(opts: {
    flightNo: string;
    date: string;
    from: string;
    depUtc: string;
    arrUtc: string;
    aircraftId: string;
    cockpitCrew: number;
    courierCrew: number;
    fuel: { density: string; takeoffFuel: string; tripFuel: string };
    load: readonly (readonly [string, string])[];
  }) {
    const date = new Date(opts.date);
    if (await prisma.flight.findFirst({ where: { flightNo: opts.flightNo, date } })) return;

    const flight = await prisma.flight.create({
      data: {
        flightNo: opts.flightNo,
        date,
        serviceType: "Scheduled intl. non-stop (cargo)",
        status: "ARRIVED",
        aircraftId: opts.aircraftId,
      },
    });
    const leg = await prisma.flightLeg.create({
      data: {
        flightId: flight.id,
        seq: 1,
        fromStationId: opts.from === "MXP" ? mxp.id : fra.id,
        toStationId: asb.id,
        stdDep: new Date(opts.depUtc),
        etdDep: new Date(opts.depUtc),
        atdDep: new Date(opts.depUtc),
        staArr: new Date(opts.arrUtc),
        ataArr: new Date(opts.arrUtc),
      },
    });
    await prisma.fuelRecord.create({
      data: {
        legId: leg.id,
        density: opts.fuel.density,
        takeoffFuel: opts.fuel.takeoffFuel,
        tripFuel: opts.fuel.tripFuel,
        taxiFuel: "600",
        refuelMode: "MANUAL",
      },
    });
    await prisma.loadPlan.create({
      data: {
        legId: leg.id,
        version: 1,
        status: "DRAFT",
        createdById: controller.id,
        cockpitCrew: opts.cockpitCrew,
        courierCrew: opts.courierCrew,
        ahmDocumentId: ahmRev2.id,
        loadItems: { create: opts.load.map(([p, w]) => seedLoadItem(p, w)) },
      },
    });
  }

  // T5 450 · 19/07/2026 · MXP-ASB · EZ-F430 · crew 2/4 · TTL 10 604
  await ensureFlownFlight({
    flightNo: "T5 450",
    date: "2026-07-19",
    from: "MXP",
    depUtc: "2026-07-19T16:50:00Z", // 18:50 local MXP (UTC+2)
    arrUtc: "2026-07-20T00:10:00Z",
    aircraftId: ez430.id,
    cockpitCrew: 2,
    courierCrew: 4,
    fuel: { density: "0.785", takeoffFuel: "29500", tripFuel: "22339" },
    load: [["HH", "2130"], ["JJ", "326"], ["KK", "870"], ["LL", "1007"], ["MM", "1850"],
           ["PP", "2870"], ["RR", "1025"], ["11", "124"], ["53", "402"]],
  });

  // T5 478 · 18/07/2026 · FRA-ASB · EZ-F429 · crew 2/5 · TTL 30 280
  await ensureFlownFlight({
    flightNo: "T5 478",
    date: "2026-07-18",
    from: "FRA",
    depUtc: "2026-07-18T16:30:00Z", // 18:30 local FRA (UTC+2)
    arrUtc: "2026-07-18T23:50:00Z",
    aircraftId: ez429.id,
    cockpitCrew: 2,
    courierCrew: 5,
    fuel: { density: "0.785", takeoffFuel: "33200", tripFuel: "25641" },
    load: [["CEL", "1590"], ["EFR", "1820"], ["FHL", "1030"], ["FHR", "760"], ["HJ", "3230"],
           ["JJ", "1010"], ["KK", "1530"], ["LL", "1510"], ["MM", "2930"], ["PP", "3140"],
           ["RR", "3400"], ["SS", "1590"], ["TT", "1500"],
           ["12P", "1490"], ["13P", "1580"], ["21P", "1030"], ["22P", "1140"]],
  });

  // T5 478 · 25/07/2026 · FRA-ASB · EZ-F430 · crew 2/4 · TTL 23 740
  await ensureFlownFlight({
    flightNo: "T5 478",
    date: "2026-07-25",
    from: "FRA",
    depUtc: "2026-07-25T16:30:00Z",
    arrUtc: "2026-07-25T23:50:00Z",
    aircraftId: ez430.id,
    cockpitCrew: 2,
    courierCrew: 4,
    fuel: { density: "0.785", takeoffFuel: "32600", tripFuel: "25164" },
    load: [["CC", "1070"], ["DD", "1570"], ["FHL", "750"], ["EE", "1600"], ["HJL", "1020"],
           ["HJR", "1610"], ["JKL", "2960"], ["JKR", "2740"], ["KML", "570"], ["KMR", "830"],
           ["MM", "2920"], ["PP", "2950"], ["RR", "1600"], ["SS", "1550"]],
  });

  // T5 478 · 01/08/2026 · FRA-ASB · EZ-F429 · crew 2/4 · TTL 13 120
  // The one sheet flown at fuel density 0.775 rather than 0.785.
  await ensureFlownFlight({
    flightNo: "T5 478",
    date: "2026-08-01",
    from: "FRA",
    depUtc: "2026-08-01T16:30:00Z",
    arrUtc: "2026-08-01T23:50:00Z",
    aircraftId: ez429.id,
    cockpitCrew: 2,
    courierCrew: 4,
    fuel: { density: "0.775", takeoffFuel: "31200", tripFuel: "23867" },
    load: [["DD", "920"], ["EE", "750"], ["FF", "750"], ["GG", "710"], ["HH", "610"],
           ["JJ", "1020"], ["KK", "1260"], ["LL", "1390"], ["MM", "1280"], ["PP", "1250"],
           ["RR", "1520"], ["SS", "710"], ["TT", "950"]],
  });

  // Faz 7 demo ULDs — codes follow the IATA convention (3-letter type code
  // + serial + 2-letter owner code) so the naming-convention validator has
  // real examples to check against. Types (PMC/PAG/PZA/PGA/FLA) come from
  // uld-types.json (a330-243p2f/ed1-rev0).
  const t5692 = await prisma.flight.findFirstOrThrow({ where: { flightNo: "T5 3431" } });
  const t5700 = await prisma.flight.findFirstOrThrow({ where: { flightNo: "T5 619" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@gmail.com" } });

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

  // Counted, not hardcoded — a stale summary is worse than none.
  const [stationCount, aircraftCount, userCount, flightCount, uldCount] = await Promise.all([
    prisma.station.count(),
    prisma.aircraft.count(),
    prisma.user.count(),
    prisma.flight.count(),
    prisma.uld.count(),
  ]);
  console.log("Seed complete:");
  console.log(
    `  ${stationCount} stations, ${aircraftCount} aircraft, ${userCount} users, ${flightCount} flights, ${uldCount} ULDs.`,
  );
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
