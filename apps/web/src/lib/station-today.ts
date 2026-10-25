import { db } from "@tua/db";
import { todayInZone } from "@/lib/timezone";

/**
 * "Today" for the account's list screens: the date in the controller's
 * station zone, not the server's. Ashgabat is the operator's base, so it
 * stands in for an account with no station.
 */
export async function stationToday(stationId: string | null | undefined): Promise<string> {
  const station = stationId
    ? await db.station.findUnique({ where: { id: stationId }, select: { timezone: true } })
    : null;
  return todayInZone(station?.timezone ?? "Asia/Ashgabat");
}
