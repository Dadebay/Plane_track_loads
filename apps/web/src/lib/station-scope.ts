import type { Role } from "./load-plan-contract";

/**
 * A station handles its own departures.
 *
 * The operator's rule (06/10/2026): Ashgabat staff work the flights that
 * leave Ashgabat and nothing else — the inbound direction is another
 * station's job, and they do not build the schedule. An outstation is the
 * mirror image: their own departures towards base. One administrator
 * account sees everything and files the flights.
 *
 * This is about who is responsible for a departure, not about secrecy, so
 * it keys on the leg's departure station: whoever loads the aircraft is
 * standing at the gate it leaves from.
 */
export interface StationScope {
  /** Sees and files everything. */
  isAdmin: boolean;
  /** Departure station the account is confined to, or null for no limit. */
  departureStationId: string | null;
}

export interface ScopedUser {
  role: Role | string;
  stationId?: string | null;
}

export function stationScopeOf(user: ScopedUser | undefined | null): StationScope {
  if (!user) return { isAdmin: false, departureStationId: null };
  if (user.role === "ADMIN") return { isAdmin: true, departureStationId: null };
  // An account with no station posted to it is not confined — a head-office
  // controller covering several stations is a real case, and inventing a
  // restriction nobody asked for would lock them out of their own work.
  return { isAdmin: false, departureStationId: user.stationId ?? null };
}

/** Whether this account may work the load plan and documents of a leg that
 * departs from `fromStationId`. */
export function canWorkDeparture(scope: StationScope, fromStationId: string): boolean {
  return scope.departureStationId === null || scope.departureStationId === fromStationId;
}

/** Filing and editing the schedule is the administrator's job: a station
 * works the flights it is given. */
export function canEditSchedule(scope: StationScope): boolean {
  return scope.isAdmin;
}
