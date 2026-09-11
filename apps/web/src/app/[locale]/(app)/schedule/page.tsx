import { db } from "@tua/db";
import { parseFlightListFilters, queryFlightLegs } from "@/lib/flight-queries";
import { serviceTypeOptions } from "@/lib/service-types";
import { utcToZonedTimeString } from "@/lib/timezone";
import { ScheduleView, type EditableFlight } from "./schedule-view";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFlightListFilters(sp);

  // The schedule lists the same legs as Flight selection, through the same
  // query, so a filter means the same thing on both screens.
  const [{ rows, total }, stations, flightsForServiceTypes, flightsForNumbers, fleet] = await Promise.all([
    queryFlightLegs(filters),
    db.station.findMany({ orderBy: { iata: "asc" } }),
    db.flight.findMany({ distinct: ["serviceType"], select: { serviceType: true }, orderBy: { serviceType: "asc" } }),
    db.flight.findMany({ distinct: ["flightNo"], select: { flightNo: true }, orderBy: { flightNo: "asc" } }),
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: "asc" } }),
  ]);

  // Editing works on the whole flight, not on one leg, so the flights behind
  // the listed legs are fetched with every leg they own.
  const flightIds = [...new Set(rows.map((r) => r.flight.id))];
  const flights = await db.flight.findMany({
    where: { id: { in: flightIds } },
    include: { legs: { include: { fromStation: true, toStation: true }, orderBy: { seq: "asc" } } },
  });

  const editableByFlightId: Record<string, EditableFlight> = {};
  for (const flight of flights) {
    editableByFlightId[flight.id] = {
      id: flight.id,
      flightNo: flight.flightNo,
      date: flight.date.toISOString().slice(0, 10),
      serviceType: flight.serviceType,
      aircraftId: flight.aircraftId,
      status: flight.status,
      legs: flight.legs.map((l) => ({
        fromStationId: l.fromStationId,
        toStationId: l.toStationId,
        via: l.via ?? "",
        stdDep: utcToZonedTimeString(l.stdDep, l.fromStation.timezone),
        staArr: utcToZonedTimeString(l.staArr, l.toStation.timezone),
      })),
    };
  }

  const flightNumberPrefixes = [
    ...new Set(
      flightsForNumbers
        .map((f) => /^([A-Za-z][A-Za-z0-9])/.exec(f.flightNo.trim())?.[1]?.toUpperCase())
        .filter((p): p is string => Boolean(p)),
    ),
  ].sort();

  return (
    <ScheduleView
      rows={rows}
      total={total}
      filters={filters}
      editableByFlightId={editableByFlightId}
      stations={stations}
      aircraft={fleet.map((a) => ({ id: a.id, registration: a.registration }))}
      serviceTypes={serviceTypeOptions(flightsForServiceTypes.map((f) => f.serviceType))}
      flightNumberPrefixes={flightNumberPrefixes}
      registrations={fleet.map((a) => a.registration)}
    />
  );
}
