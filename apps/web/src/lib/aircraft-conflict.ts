import { db } from "@tua/db";

/**
 * Faz 6 — "aynı uçağa çakışan uçuş atanamaz". Two time ranges conflict if
 * they overlap at all (half-open interval comparison — touching endpoints,
 * e.g. one leg's STA exactly equal to the next leg's STD, do NOT count as
 * a conflict, matching real turnaround scheduling).
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface CandidateLegTime {
  stdDep: Date;
  staArr: Date;
}

export interface AircraftConflict {
  legId: string;
  flightId: string;
  flightNo: string;
  stdDep: Date;
  staArr: Date;
}

/**
 * Checks a set of candidate leg time ranges (a flight being created/edited)
 * against every OTHER non-cancelled flight already assigned to the same
 * aircraft. `excludeFlightId` is passed when editing an existing flight, so
 * it doesn't conflict with its own (pre-edit) legs.
 */
export async function findAircraftConflicts(
  aircraftId: string,
  candidateLegs: CandidateLegTime[],
  excludeFlightId?: string,
): Promise<AircraftConflict[]> {
  const existingLegs = await db.flightLeg.findMany({
    where: {
      flight: {
        aircraftId,
        status: { not: "CANCELLED" },
        ...(excludeFlightId ? { id: { not: excludeFlightId } } : {}),
      },
    },
    include: { flight: true },
  });

  const conflicts: AircraftConflict[] = [];
  for (const existing of existingLegs) {
    const hasOverlap = candidateLegs.some((candidate) =>
      rangesOverlap(existing.stdDep, existing.staArr, candidate.stdDep, candidate.staArr),
    );
    if (hasOverlap) {
      conflicts.push({
        legId: existing.id,
        flightId: existing.flight.id,
        flightNo: existing.flight.flightNo,
        stdDep: existing.stdDep,
        staArr: existing.staArr,
      });
    }
  }
  return conflicts;
}
