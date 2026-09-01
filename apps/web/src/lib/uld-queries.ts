import { db, Prisma } from "@tua/db";
import { DEFAULT_PAGE_SIZE } from "./pagination";

const SORTABLE_KEYS = [
  "code",
  "typeCode",
  "serial",
  "ownerCode",
  "assignedStation",
  "currentStation",
  "status",
  "baseplateCode",
] as const;

export type UldSortKey = (typeof SORTABLE_KEYS)[number];

export interface UldListFilters {
  code?: string;
  serial?: string;
  typeCode?: string;
  ownerCode?: string;
  assignedStation?: string;
  currentStation?: string;
  status?: string;
  condition?: string;
  baseplateCode?: string;
  sort?: UldSortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function parseUldListFilters(searchParams: Record<string, string | string[] | undefined>): UldListFilters {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Number(get("page"));
  const pageSize = Number(get("pageSize"));
  const sort = get("sort");

  return {
    code: get("code") || undefined,
    serial: get("serial") || undefined,
    typeCode: get("typeCode") || undefined,
    ownerCode: get("ownerCode") || undefined,
    assignedStation: get("assignedStation") || undefined,
    currentStation: get("currentStation") || undefined,
    status: get("status") || undefined,
    condition: get("condition") || undefined,
    baseplateCode: get("baseplateCode") || undefined,
    sort: (SORTABLE_KEYS as readonly string[]).includes(sort ?? "") ? (sort as UldSortKey) : "code",
    dir: get("dir") === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

/** True once any real filter (not just paging/sort) has been applied — the
 * list starts empty with a "use the filters" prompt (Faz 7 kabul kriteri). */
export function hasActiveUldFilter(filters: UldListFilters): boolean {
  return Boolean(
    filters.code ||
      filters.serial ||
      filters.typeCode ||
      filters.ownerCode ||
      filters.assignedStation ||
      filters.currentStation ||
      filters.status ||
      filters.condition ||
      filters.baseplateCode,
  );
}

export type UldRow = Prisma.UldGetPayload<{
  include: { assignedStation: true; currentStation: true; currentFlight: true };
}>;

export async function queryUlds(filters: UldListFilters): Promise<{ rows: UldRow[]; total: number }> {
  const where: Prisma.UldWhereInput = {
    ...(filters.code ? { code: { contains: filters.code, mode: "insensitive" } } : {}),
    ...(filters.serial ? { serial: { contains: filters.serial, mode: "insensitive" } } : {}),
    ...(filters.typeCode ? { typeCode: { equals: filters.typeCode, mode: "insensitive" } } : {}),
    ...(filters.ownerCode ? { ownerCode: { contains: filters.ownerCode, mode: "insensitive" } } : {}),
    ...(filters.assignedStation ? { assignedStation: { iata: { equals: filters.assignedStation, mode: "insensitive" } } } : {}),
    ...(filters.currentStation ? { currentStation: { iata: { equals: filters.currentStation, mode: "insensitive" } } } : {}),
    ...(filters.status ? { status: filters.status as Prisma.EnumUldStatusFilter["equals"] } : {}),
    ...(filters.condition ? { condition: filters.condition as Prisma.EnumUldConditionFilter["equals"] } : {}),
    ...(filters.baseplateCode ? { baseplateCode: { contains: filters.baseplateCode, mode: "insensitive" } } : {}),
  };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const orderBy: Prisma.UldOrderByWithRelationInput =
    filters.sort === "assignedStation"
      ? { assignedStation: { iata: filters.dir } }
      : filters.sort === "currentStation"
        ? { currentStation: { iata: filters.dir } }
        : { [filters.sort ?? "code"]: filters.dir };

  const [rows, total] = await Promise.all([
    db.uld.findMany({
      where,
      include: { assignedStation: true, currentStation: true, currentFlight: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.uld.count({ where }),
  ]);

  return { rows, total };
}
