import { db } from "@tua/db";
import { parseFlightListFilters, queryFlightLegs } from "@/lib/flight-queries";
import { serviceTypeOptions } from "@/lib/service-types";
import { DocumentsView, type LegDocuments } from "./documents-view";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFlightListFilters(sp);

  // The document page lists the same legs as Flight selection, through the
  // same query, so a filter means the same thing on every screen.
  const [{ rows, total }, stations, flightsForServiceTypes, flightsForNumbers, fleet, users] = await Promise.all([
    queryFlightLegs(filters),
    db.station.findMany({ orderBy: { iata: "asc" } }),
    db.flight.findMany({ distinct: ["serviceType"], select: { serviceType: true }, orderBy: { serviceType: "asc" } }),
    db.flight.findMany({ distinct: ["flightNo"], select: { flightNo: true }, orderBy: { flightNo: "asc" } }),
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: "asc" } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const legIds = rows.map((r) => r.id);
  const [documents, finalizedPlans] = await Promise.all([
    db.document.findMany({ where: { legId: { in: legIds } }, orderBy: { edition: "asc" } }),
    db.loadPlan.findMany({ where: { legId: { in: legIds }, status: "FINALIZED" }, select: { legId: true } }),
  ]);

  // Faz 12 — the highest edition per (leg, type) is the current one. Earlier
  // editions are never deleted (Document rows are insert-only, CLAUDE.md
  // rule #5); the page links to the current edition of each type.
  const current: Record<string, LegDocuments> = {};
  for (const doc of documents) {
    const forLeg = (current[doc.legId] ??= {});
    const held = forLeg[doc.type];
    if (!held || doc.edition > held.edition) {
      forLeg[doc.type] = { id: doc.id, edition: doc.edition, issuedAt: doc.issuedAt.toISOString() };
    }
  }

  const flightNumberPrefixes = [
    ...new Set(
      flightsForNumbers
        .map((f) => /^([A-Za-z][A-Za-z0-9])/.exec(f.flightNo.trim())?.[1]?.toUpperCase())
        .filter((p): p is string => Boolean(p)),
    ),
  ].sort();

  return (
    <DocumentsView
      rows={rows}
      total={total}
      filters={filters}
      documentsByLegId={current}
      finalizedLegIds={[...new Set(finalizedPlans.map((p) => p.legId))]}
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      stations={stations}
      serviceTypes={serviceTypeOptions(flightsForServiceTypes.map((f) => f.serviceType))}
      flightNumberPrefixes={flightNumberPrefixes}
      registrations={fleet.map((a) => a.registration)}
    />
  );
}
