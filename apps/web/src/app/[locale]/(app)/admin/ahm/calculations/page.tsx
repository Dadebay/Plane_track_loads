import { db } from "@tua/db";
import { AhmCalculationsView, type CalculationRow } from "./ahm-calculations-view";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function AhmCalculationsPage() {
  const calculations = await db.wnbCalculation.findMany({
    orderBy: { calculatedAt: "desc" },
    include: {
      leg: { include: { flight: true } },
      ahmDocument: true,
    },
  });

  const rows: CalculationRow[] = calculations.map((c) => ({
    id: c.id,
    edition: c.edition,
    calculatedAt: c.calculatedAt,
    flightNo: c.leg.flight.flightNo,
    legSeq: c.leg.seq,
    ahmAircraftType: c.ahmDocument.aircraftType,
    ahmEdition: c.ahmDocument.edition,
    ahmRevision: c.ahmDocument.revision,
  }));

  return <AhmCalculationsView rows={rows} />;
}
