import { db, Prisma } from "@tua/db";
import { DEFAULT_PAGE_SIZE } from "./pagination";
import { flightNoSearchVariants } from "./flight-number";

export interface FlightListFilters {
  from?: string;
  /** Intermediate station of a multi-stop leg — FlightLeg.via. */
  via?: string;
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

/** Params that narrow the list. `sort`, `dir`, `page` and `pageSize` are
 * not among them: they say how to show the result, not which flights. */
const FILTER_PARAMS = [
  "from",
  "via",
  "to",
  "flightNo",
  "registration",
  "dayOfWeek",
  "serviceType",
  "dateFrom",
  "dateTo",
] as const;

/** True when the request carries no filter of its own — a fresh arrival at
 * the page rather than a search someone typed. */
export function hasNoFlightFilter(searchParams: Record<string, string | string[] | undefined>): boolean {
  return FILTER_PARAMS.every((key) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value) ? false : true;
  });
}

/**
 * `defaultDate` ("YYYY-MM-DD") fills the date range when the request has no
 * filters at all, so signing in lands on today's flights instead of the
 * whole schedule. It is deliberately not applied when something else is
 * filtered: a controller searching for flight 692 wants that flight, not
 * today's 692.
 */
export function parseFlightListFilters(
  searchParams: Record<string, string | string[] | undefined>,
  defaultDate?: string,
): FlightListFilters {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Number(get("page"));
  const pageSize = Number(get("pageSize"));
  const dayOfWeek = Number(get("dayOfWeek"));

  return {
    from: get("from") || undefined,
    via: get("via") || undefined,
    to: get("to") || undefined,
    flightNo: get("flightNo") || undefined,
    registration: get("registration") || undefined,
    dayOfWeek: Number.isInteger(dayOfWeek) && dayOfWeek >= 1 && dayOfWeek <= 7 ? dayOfWeek : undefined,
    serviceType: get("serviceType") || undefined,
    dateFrom: get("dateFrom") || (hasNoFlightFilter(searchParams) ? defaultDate : undefined) || undefined,
    dateTo: get("dateTo") || (hasNoFlightFilter(searchParams) ? defaultDate : undefined) || undefined,
    sort: (get("sort") as FlightListFilters["sort"]) || "stdDep",
    dir: get("dir") === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

export type FlightLegRow = Prisma.FlightLegGetPayload<{
  include: { flight: { include: { aircraft: true } }; fromStation: true; toStation: true };
}>;

/**
 * `departureStationId` is the account's own station, not a filter the user
 * typed: an outstation sees the flights it dispatches and not the rest of
 * the network (see `station-scope.ts`). It is applied on top of the filters
 * rather than through them, so clearing the filters cannot widen it.
 */
export async function queryFlightLegs(
  filters: FlightListFilters,
  departureStationId?: string | null,
): Promise<{ rows: FlightLegRow[]; total: number }> {
  const where: Prisma.FlightLegWhereInput = {
    ...(departureStationId ? { fromStationId: departureStationId } : {}),
    ...(filters.from ? { fromStation: { iata: { equals: filters.from, mode: "insensitive" } } } : {}),
    ...(filters.via ? { via: { contains: filters.via, mode: "insensitive" } } : {}),
    ...(filters.to ? { toStation: { iata: { equals: filters.to, mode: "insensitive" } } } : {}),
    flight: {
      // "T5 692" also has to find a flight someone filed as "T5-692" or
      // "T5692" before the entry form offered the carrier dropdown.
      ...(filters.flightNo
        ? {
            OR: flightNoSearchVariants(filters.flightNo).map((variant) => ({
              flightNo: { contains: variant, mode: "insensitive" as const },
            })),
          }
        : {}),
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
