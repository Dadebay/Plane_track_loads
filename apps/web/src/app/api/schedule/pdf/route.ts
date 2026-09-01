import { db } from "@tua/db";
import { renderScheduleListPdf, type ScheduleListFlight } from "@tua/documents";
import { auth } from "@/auth";
import { utcToZonedTimeString } from "@/lib/timezone";

/**
 * `/schedule` page's "Export PDF" action — a flat listing of the current
 * flight schedule. Sits under /api, which middleware.ts's matcher
 * intentionally excludes, so auth is checked here directly (see the
 * admin/ahm routes for the same pattern).
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const flights = await db.flight.findMany({
    include: {
      aircraft: true,
      legs: { include: { fromStation: true, toStation: true }, orderBy: { seq: "asc" } },
    },
    orderBy: { date: "desc" },
  });

  const rows: ScheduleListFlight[] = flights.map((f) => {
    const firstLeg = f.legs[0];
    const lastLeg = f.legs[f.legs.length - 1];
    const stops = [firstLeg?.fromStation.iata, ...f.legs.map((l) => l.toStation.iata)].filter(Boolean);

    return {
      flightNo: f.flightNo,
      date: f.date.toISOString().slice(0, 10),
      status: f.status,
      serviceType: f.serviceType,
      aircraftRegistration: f.aircraft.registration,
      aircraftType: f.aircraft.type,
      route: stops.join("-"),
      stdDep: firstLeg
        ? `${utcToZonedTimeString(firstLeg.stdDep, firstLeg.fromStation.timezone).replace("T", " ")} ${firstLeg.fromStation.iata}`
        : "—",
      staArr: lastLeg
        ? `${utcToZonedTimeString(lastLeg.staArr, lastLeg.toStation.timezone).replace("T", " ")} ${lastLeg.toStation.iata}`
        : "—",
    };
  });

  const buffer = await renderScheduleListPdf(rows);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="flight-schedule-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
