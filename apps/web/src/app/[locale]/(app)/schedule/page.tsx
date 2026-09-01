import { db } from "@tua/db";
import { utcToZonedTimeString } from "@/lib/timezone";
import { ScheduleView, type ScheduleFlightRow } from "./schedule-view";

export default async function SchedulePage() {
  const [flights, stations, aircraft] = await Promise.all([
    db.flight.findMany({
      include: {
        aircraft: true,
        legs: { include: { fromStation: true, toStation: true }, orderBy: { seq: "asc" } },
      },
      orderBy: { date: "desc" },
    }),
    db.station.findMany({ orderBy: { iata: "asc" } }),
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: "asc" } }),
  ]);

  const rows: ScheduleFlightRow[] = flights.map((f) => {
    const stops = [f.legs[0]?.fromStation.iata, ...f.legs.map((l) => l.toStation.iata)].filter(Boolean);
    return {
      id: f.id,
      flightNo: f.flightNo,
      date: f.date.toISOString().slice(0, 10),
      serviceType: f.serviceType,
      status: f.status,
      aircraftId: f.aircraftId,
      aircraftRegistration: f.aircraft.registration,
      route: stops.join("-"),
      legs: f.legs.map((l) => ({
        fromStationId: l.fromStationId,
        toStationId: l.toStationId,
        via: l.via ?? "",
        stdDep: utcToZonedTimeString(l.stdDep, l.fromStation.timezone),
        staArr: utcToZonedTimeString(l.staArr, l.toStation.timezone),
      })),
    };
  });

  return (
    <ScheduleView
      flights={rows}
      stations={stations.map((s) => ({ id: s.id, iata: s.iata, name: s.name }))}
      aircraft={aircraft.map((a) => ({ id: a.id, registration: a.registration }))}
    />
  );
}
