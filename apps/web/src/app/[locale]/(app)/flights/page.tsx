import { db } from "@tua/db";
import { parseFlightListFilters, queryFlightLegs } from "@/lib/flight-queries";
import { serviceTypeOptions } from "@/lib/service-types";
import { FlightsListView } from "./flights-list-view";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFlightListFilters(sp);

  const [{ rows, total }, stations, flightsForServiceTypes, flightsForNumbers, fleet] = await Promise.all([
    queryFlightLegs(filters),
    db.station.findMany({ orderBy: { iata: "asc" } }),
    db.flight.findMany({ distinct: ["serviceType"], select: { serviceType: true }, orderBy: { serviceType: "asc" } }),
    db.flight.findMany({ distinct: ["flightNo"], select: { flightNo: true }, orderBy: { flightNo: "asc" } }),
    db.aircraft.findMany({
      where: { active: true },
      select: { registration: true },
      orderBy: { registration: "asc" },
    }),
  ]);

  // The full catalogue, plus any legacy value the schedule still stores —
  // a type has to be offered before the first flight of that kind exists.
  const serviceTypes = serviceTypeOptions(flightsForServiceTypes.map((f) => f.serviceType));

  // Carrier prefixes actually present in the schedule ("T5 692" -> "T5"),
  // so the flight-number filter offers real choices instead of a hardcoded
  // airline list. A flight number with no prefix contributes nothing.
  const flightNumberPrefixes = [
    ...new Set(
      flightsForNumbers
        .map((f) => /^([A-Za-z][A-Za-z0-9])/.exec(f.flightNo.trim())?.[1]?.toUpperCase())
        .filter((p): p is string => Boolean(p)),
    ),
  ].sort();

  return (
    <FlightsListView
      rows={rows}
      total={total}
      filters={filters}
      stations={stations}
      serviceTypes={serviceTypes}
      flightNumberPrefixes={flightNumberPrefixes}
      registrations={fleet.map((a) => a.registration)}
    />
  );
}
