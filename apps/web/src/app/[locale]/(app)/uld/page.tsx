import { db } from "@tua/db";
import { loadAhmData } from "@tua/ahm-data";
import { hasActiveUldFilter, parseUldListFilters, queryUlds } from "@/lib/uld-queries";
import { UldListView } from "./uld-list-view";

export default async function UldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseUldListFilters(sp);
  const active = hasActiveUldFilter(filters);

  const [{ rows, total }, stations, typeCodeRows, flights, ahmDoc] = await Promise.all([
    active ? queryUlds(filters) : Promise.resolve({ rows: [], total: 0 }),
    db.station.findMany({ orderBy: { iata: "asc" } }),
    db.uld.findMany({ distinct: ["typeCode"], select: { typeCode: true }, orderBy: { typeCode: "asc" } }),
    db.flight.findMany({ orderBy: { date: "desc" }, select: { id: true, flightNo: true, date: true } }),
    db.ahmDocument.findFirst({ orderBy: [{ edition: "desc" }, { revision: "desc" }] }),
  ]);

  const typeCodes = typeCodeRows.map((r) => r.typeCode);
  const uldTypeInfo = ahmDoc
    ? loadAhmData(ahmDoc.aircraftType, ahmDoc.edition, ahmDoc.revision).uldTypes.types
    : [];

  return (
    <UldListView
      rows={rows}
      total={total}
      filters={filters}
      active={active}
      stations={stations.map((s) => ({ id: s.id, iata: s.iata, name: s.name }))}
      typeCodes={typeCodes}
      flights={flights.map((f) => ({ id: f.id, flightNo: f.flightNo, date: f.date.toISOString().slice(0, 10) }))}
      uldTypeInfo={uldTypeInfo.map((t) => ({
        typeCode: t.typeCode,
        tareWeight: t.tareWeight,
        grossWeight: t.grossWeight,
        volume: t.volume,
        deck: t.deck,
      }))}
    />
  );
}
