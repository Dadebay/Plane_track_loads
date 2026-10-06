import { db } from "@tua/db";
import { UsersView } from "./users-view";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built.
 */
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, stations] = await Promise.all([
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { station: { select: { iata: true } } },
    }),
    db.station.findMany({ orderBy: { iata: "asc" }, select: { id: true, iata: true, name: true } }),
  ]);

  return (
    <UsersView
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        stationId: u.stationId,
        stationIata: u.station?.iata ?? null,
        createdAt: u.createdAt.toISOString(),
      }))}
      stations={stations}
    />
  );
}
