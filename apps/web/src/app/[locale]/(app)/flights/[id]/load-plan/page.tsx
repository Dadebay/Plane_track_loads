import { notFound } from "next/navigation";
import { db } from "@tua/db";
import { getLoadPlanAhmData } from "@/lib/load-plan-ahm";
import { formatDateTimeInZone } from "@/lib/format-date";
import type { LoadDraftInit } from "./load-draft-store";
import { LoadPlanShell } from "./load-plan-shell";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function LoadPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: legId } = await params;

  const leg = await db.flightLeg.findUnique({
    where: { id: legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      toStation: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1, include: { loadItems: true } },
      fuelRecord: { include: { allocations: true } },
    },
  });
  if (!leg) notFound();

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef, leg.flight.aircraft.registration);

  const latestPlan = leg.loadPlans[0] ?? null;

  const initialDraft: LoadDraftInit = {
    items: (latestPlan?.loadItems ?? []).map((li) => ({
      position: li.position,
      weight: li.weight.toString(),
      tareWeight: li.tareWeight?.toString(),
      netWeight: li.netWeight?.toString(),
      uldCode: li.uldCode ?? undefined,
      awb: li.awb ?? undefined,
      contentCode: li.contentCode ?? undefined,
      uldType: li.uldType ?? undefined,
    })),
    fuel: leg.fuelRecord
      ? {
          density: leg.fuelRecord.density.toString(),
          takeoffFuel: leg.fuelRecord.takeoffFuel.toString(),
          tripFuel: leg.fuelRecord.tripFuel.toString(),
          taxiFuel: leg.fuelRecord.taxiFuel.toString(),
        }
      : { density: "0.785", takeoffFuel: "0", tripFuel: "0", taxiFuel: "0" },
    fuelAllocations: (leg.fuelRecord?.allocations ?? []).map((a) => ({
      tank: a.tank,
      side: a.side,
      weight: a.weight.toString(),
    })),
    cockpitCrew: latestPlan?.cockpitCrew ?? null,
    courierCrew: latestPlan?.courierCrew ?? null,
  };

  // Formatted here, in the departure station's zone, rather than in the
  // client: a date rendered from the browser's own zone would differ from
  // the server's first paint and break hydration (the same failure the
  // flights list had with weekday names).
  const [stdDepDate, stdDepTime] = formatDateTimeInZone(leg.stdDep, leg.fromStation.timezone).split(", ");

  return (
    <LoadPlanShell
      legId={leg.id}
      flightNo={leg.flight.flightNo}
      registration={leg.flight.aircraft.registration}
      fromIata={leg.fromStation.iata}
      toIata={leg.toStation.iata}
      stdDepDate={stdDepDate ?? ""}
      stdDepTime={stdDepTime ?? ""}
      ahmData={ahmData}
      initialDraft={initialDraft}
      planVersion={latestPlan?.version ?? 0}
      planStatus={latestPlan?.status ?? null}
    />
  );
}
