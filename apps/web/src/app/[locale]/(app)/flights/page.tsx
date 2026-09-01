import { db } from "@tua/db";
import { parseFlightListFilters, queryFlightLegs } from "@/lib/flight-queries";
import { FlightsListView } from "./flights-list-view";

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFlightListFilters(sp);

  const [{ rows, total }, stations, flightsForServiceTypes] = await Promise.all([
    queryFlightLegs(filters),
    db.station.findMany({ orderBy: { iata: "asc" } }),
    db.flight.findMany({ distinct: ["serviceType"], select: { serviceType: true }, orderBy: { serviceType: "asc" } }),
  ]);

  const serviceTypes = flightsForServiceTypes.map((f) => f.serviceType);

  return <FlightsListView rows={rows} total={total} filters={filters} stations={stations} serviceTypes={serviceTypes} />;
}
