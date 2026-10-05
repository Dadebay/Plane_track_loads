"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, Prisma } from "@tua/db";
import { auth } from "@/auth";
import { findAircraftConflicts } from "@/lib/aircraft-conflict";
import { formatDateTimeInZone as formatDateTime } from "@/lib/format-date";
import { zonedTimeToUtc } from "@/lib/timezone";

const FLIGHT_STATUSES = ["RESERVED", "PLANNED", "LOADING", "FINALIZED", "DEPARTED", "ARRIVED", "CANCELLED"] as const;

const legSchema = z
  .object({
    fromStationId: z.string().min(1, "requiredField"),
    toStationId: z.string().min(1, "requiredField"),
    via: z.string().optional(),
    stdDep: z.string().min(1, "requiredField"),
    staArr: z.string().min(1, "requiredField"),
  })
  .refine((leg) => leg.fromStationId !== leg.toStationId, {
    message: "sameStationError",
    path: ["toStationId"],
  });

const flightSchema = z.object({
  flightNo: z.string().min(1, "requiredField"),
  date: z.string().min(1, "requiredField"),
  serviceType: z.string().min(1, "requiredField"),
  aircraftId: z.string().min(1, "requiredField"),
  status: z.enum(FLIGHT_STATUSES).optional(),
  legs: z.array(legSchema).min(1, "atLeastOneLeg"),
});

export type FlightFormInput = z.infer<typeof flightSchema>;

export interface FlightActionResult {
  ok: boolean;
  error?: string;
  /**
   * Second line under the headline error: the arithmetic the controller
   * cannot see. "Arrival must be after departure" is baffling in front of
   * an 09:35 departure and an 11:55 arrival — the two clocks belong to
   * different stations, and only their UTC instants are comparable. Naming
   * both conversions points at the real mistake, which is almost always the
   * wrong arrival station (ICN filed for SVO moves arrival four zones east).
   */
  errorDetail?: string;
  errorParams?: Record<string, string | number>;
  conflictFlightNo?: string;
  flightId?: string;
}

interface LegTimeError {
  error: string;
  detail: string;
  params: Record<string, string | number>;
}

interface ResolvedLeg {
  fromStationId: string;
  toStationId: string;
  via: string | null;
  stdDep: Date;
  staArr: Date;
}

const MAX_LEG_DURATION_MS = 72 * 60 * 60 * 1000;

/** Splits a span into whole hours and minutes so each locale can word it. */
function withHoursMinutes(ms: number, e: LegTimeError): LegTimeError {
  const minutes = Math.round(ms / 60_000);
  return { ...e, params: { ...e.params, gapHours: Math.floor(minutes / 60), gapMinutes: minutes % 60 } };
}

/**
 * Departure/arrival times are entered as wall-clock time at their
 * respective station (aviation convention — STD/STA are always
 * station-local, never the browser's timezone). Resolves each leg's
 * strings to true UTC instants using the actual station timezones, then
 * validates arrival-after-departure and a loose sanity bound on enroute
 * duration ("enroute süresi tutarlı") — both need real UTC instants to be
 * checked correctly across legs that cross timezones.
 */
async function resolveLegTimes(
  legs: FlightFormInput["legs"],
): Promise<{ ok: true; legs: ResolvedLeg[] } | ({ ok: false } & Partial<LegTimeError> & { error: string })> {
  const stationIds = [...new Set(legs.flatMap((l) => [l.fromStationId, l.toStationId]))];
  const stations = await db.station.findMany({ where: { id: { in: stationIds } } });
  const tzById = new Map(stations.map((s) => [s.id, s.timezone]));
  const iataById = new Map(stations.map((s) => [s.id, s.iata]));

  const resolved: ResolvedLeg[] = [];
  for (const leg of legs) {
    const fromTz = tzById.get(leg.fromStationId);
    const toTz = tzById.get(leg.toStationId);
    if (!fromTz || !toTz) return { ok: false, error: "requiredField" };

    const stdDep = zonedTimeToUtc(leg.stdDep, fromTz);
    const staArr = zonedTimeToUtc(leg.staArr, toTz);
    const spanMs = staArr.getTime() - stdDep.getTime();
    const context = {
      leg: resolved.length + 1,
      dep: iataById.get(leg.fromStationId) ?? "",
      depLocal: formatDateTime(stdDep, fromTz),
      depUtc: formatDateTime(stdDep, "UTC"),
      arr: iataById.get(leg.toStationId) ?? "",
      arrLocal: formatDateTime(staArr, toTz),
      arrUtc: formatDateTime(staArr, "UTC"),
    };

    if (spanMs <= 0) {
      return {
        ok: false,
        ...withHoursMinutes(-spanMs, {
          error: "arrivalBeforeDepartureError",
          detail: "arrivalBeforeDepartureDetail",
          params: context,
        }),
      };
    }
    if (spanMs > MAX_LEG_DURATION_MS) {
      return {
        ok: false,
        ...withHoursMinutes(spanMs, {
          error: "legTooLongError",
          detail: "legTooLongDetail",
          params: { ...context, limitHours: MAX_LEG_DURATION_MS / 3_600_000 },
        }),
      };
    }

    resolved.push({ fromStationId: leg.fromStationId, toStationId: leg.toStationId, via: leg.via || null, stdDep, staArr });
  }
  return { ok: true, legs: resolved };
}

async function writeAudit(
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  actorId: string | undefined,
): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      entity: "Flight",
      entityId,
      before: (before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      actorId: actorId ?? null,
    },
  });
}

export async function createFlight(input: FlightFormInput): Promise<FlightActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const resolvedLegs = await resolveLegTimes(data.legs);
  if (!resolvedLegs.ok) {
    return { ok: false, error: resolvedLegs.error, errorDetail: resolvedLegs.detail, errorParams: resolvedLegs.params };
  }

  const conflicts = await findAircraftConflicts(data.aircraftId, resolvedLegs.legs);
  if (conflicts.length > 0) {
    return { ok: false, error: "conflictError", conflictFlightNo: conflicts[0]!.flightNo };
  }

  const flight = await db.flight.create({
    data: {
      flightNo: data.flightNo,
      date: new Date(data.date),
      serviceType: data.serviceType,
      aircraftId: data.aircraftId,
      status: data.status ?? "RESERVED",
      legs: {
        create: resolvedLegs.legs.map((leg, i) => ({
          seq: i + 1,
          fromStationId: leg.fromStationId,
          toStationId: leg.toStationId,
          via: leg.via,
          stdDep: leg.stdDep,
          staArr: leg.staArr,
        })),
      },
    },
  });

  await writeAudit("create", flight.id, null, { flightNo: data.flightNo, legCount: data.legs.length }, session.user.id);

  revalidatePath("/[locale]/flights", "page");
  revalidatePath("/[locale]/schedule", "page");
  return { ok: true, flightId: flight.id };
}

export async function updateFlight(flightId: string, input: FlightFormInput): Promise<FlightActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const before = await db.flight.findUnique({ where: { id: flightId }, include: { legs: true } });
  if (!before) return { ok: false, error: "notFound" };

  const resolvedLegs = await resolveLegTimes(data.legs);
  if (!resolvedLegs.ok) {
    return { ok: false, error: resolvedLegs.error, errorDetail: resolvedLegs.detail, errorParams: resolvedLegs.params };
  }

  const conflicts = await findAircraftConflicts(data.aircraftId, resolvedLegs.legs, flightId);
  if (conflicts.length > 0) {
    return { ok: false, error: "conflictError", conflictFlightNo: conflicts[0]!.flightNo };
  }

  await db.$transaction([
    db.flightLeg.deleteMany({ where: { flightId } }),
    db.flight.update({
      where: { id: flightId },
      data: {
        flightNo: data.flightNo,
        date: new Date(data.date),
        serviceType: data.serviceType,
        aircraftId: data.aircraftId,
        status: data.status ?? before.status,
        legs: {
          create: resolvedLegs.legs.map((leg, i) => ({
            seq: i + 1,
            fromStationId: leg.fromStationId,
            toStationId: leg.toStationId,
            via: leg.via,
            stdDep: leg.stdDep,
            staArr: leg.staArr,
          })),
        },
      },
    }),
  ]);

  await writeAudit(
    "update",
    flightId,
    { flightNo: before.flightNo, status: before.status, legCount: before.legs.length },
    { flightNo: data.flightNo, status: data.status ?? before.status, legCount: data.legs.length },
    session.user.id,
  );

  revalidatePath("/[locale]/flights", "page");
  revalidatePath("/[locale]/schedule", "page");
  return { ok: true, flightId };
}
