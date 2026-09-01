import { db, Prisma } from "@tua/db";
import { DEFAULT_PAGE_SIZE } from "./pagination";

export interface FlightListFilters {
  from?: string;
  to?: string;
  flightNo?: string;
  registration?: string;
  /** ISO weekday, 1 (Monday) - 7 (Sunday) — matches Intl/JS getDay() mapped so 0 (Sunday) becomes 7. */
  dayOfWeek?: number;
  serviceType?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "stdDep" | "flightNo" | "status" | "from" | "to";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function parseFlightListFilters(searchParams: Record<string, string | string[] | undefined>): FlightListFilters {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Number(get("page"));
  const pageSize = Number(get("pageSize"));
  const dayOfWeek = Number(get("dayOfWeek"));

  return {
    from: get("from") || undefined,
    to: get("to") || undefined,
    flightNo: get("flightNo") || undefined,
    registration: get("registration") || undefined,
    dayOfWeek: Number.isInteger(dayOfWeek) && dayOfWeek >= 1 && dayOfWeek <= 7 ? dayOfWeek : undefined,
    serviceType: get("serviceType") || undefined,
    dateFrom: get("dateFrom") || undefined,
    dateTo: get("dateTo") || undefined,
    sort: (get("sort") as FlightListFilters["sort"]) || "stdDep",
    dir: get("dir") === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

export type FlightLegRow = Prisma.FlightLegGetPayload<{
  include: { flight: { include: { aircraft: true } }; fromStation: true; toStation: true };
}>;

export async function queryFlightLegs(filters: FlightListFilters): Promise<{ rows: FlightLegRow[]; total: number }> {
  const where: Prisma.FlightLegWhereInput = {
    ...(filters.from ? { fromStation: { iata: { equals: filters.from, mode: "insensitive" } } } : {}),
    ...(filters.to ? { toStation: { iata: { equals: filters.to, mode: "insensitive" } } } : {}),
    flight: {
      ...(filters.flightNo ? { flightNo: { contains: filters.flightNo, mode: "insensitive" } } : {}),
      ...(filters.serviceType ? { serviceType: { equals: filters.serviceType, mode: "insensitive" } } : {}),
      ...(filters.registration
        ? { aircraft: { registration: { contains: filters.registration, mode: "insensitive" } } }
        : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    },
  };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const orderBy: Prisma.FlightLegOrderByWithRelationInput =
    filters.sort === "flightNo"
      ? { flight: { flightNo: filters.dir } }
      : filters.sort === "status"
        ? { flight: { status: filters.dir } }
        : filters.sort === "from"
          ? { fromStation: { iata: filters.dir } }
          : filters.sort === "to"
            ? { toStation: { iata: filters.dir } }
            : { stdDep: filters.dir };

  // Fetched unpaginated and sliced in JS below: the dayOfWeek filter needs
  // timezone-aware weekday matching that Prisma/SQL can't express directly
  // (no EXTRACT(DOW) helper aware of the departure station's IANA zone),
  // so it always runs client-side. Acceptable at this system's scale (one
  // airline's schedule — dozens to low hundreds of legs, not a
  // multi-tenant fleet); would need DB-level pagination if that changes.
  const allRows = await db.flightLeg.findMany({
    where,
    include: { flight: { include: { aircraft: true } }, fromStation: true, toStation: true },
    orderBy,
  });

  const filtered =
    filters.dayOfWeek !== undefined
      ? allRows.filter((row) => {
          const isoDay = new Intl.DateTimeFormat("en-US", { timeZone: row.fromStation.timezone, weekday: "short" }).format(
            row.stdDep,
          );
          const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
          return dayMap[isoDay] === filters.dayOfWeek;
        })
      : allRows;

  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  return { rows, total: filtered.length };
}
