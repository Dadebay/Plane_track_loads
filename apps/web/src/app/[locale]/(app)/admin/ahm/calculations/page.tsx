import { db } from "@tua/db";
import { AhmCalculationsView, type CalculationRow } from "./ahm-calculations-view";

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
