import { db } from "@tua/db";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const [legs, users, documents] = await Promise.all([
    db.flightLeg.findMany({
      where: { loadPlans: { some: { status: "FINALIZED" } } },
      include: {
        flight: { include: { aircraft: true } },
        fromStation: true,
        toStation: true,
      },
      orderBy: { stdDep: "desc" },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.document.findMany({
      include: {
        leg: { include: { flight: true } },
        preparedBy: true,
        checkedBy: true,
      },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  // Faz 12 — the highest edition per (leg, type) is current; every earlier
  // edition of that same document is SUPERSEDED (still accessible, never
  // deleted — Document rows are insert-only, CLAUDE.md rule #5).
  const maxEditionByGroup = new Map<string, number>();
  for (const doc of documents) {
    const key = `${doc.legId}:${doc.type}`;
    maxEditionByGroup.set(key, Math.max(maxEditionByGroup.get(key) ?? 0, doc.edition));
  }

  return (
    <DocumentsView
      legs={legs.map((leg) => ({
        id: leg.id,
        flightNo: leg.flight.flightNo,
        route: `${leg.fromStation.iata}-${leg.toStation.iata}`,
        date: leg.flight.date.toISOString().slice(0, 10),
      }))}
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      documents={documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        edition: doc.edition,
        flightNo: doc.leg.flight.flightNo,
        preparedByName: doc.preparedBy.name,
        checkedByName: doc.checkedBy.name,
        issuedAt: doc.issuedAt.toISOString(),
        superseded: doc.edition < (maxEditionByGroup.get(`${doc.legId}:${doc.type}`) ?? doc.edition),
      }))}
    />
  );
}
