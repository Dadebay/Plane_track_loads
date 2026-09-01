import { notFound } from "next/navigation";
import { db } from "@tua/db";
import { getLoadPlanAhmData } from "@/lib/load-plan-ahm";
import type { LoadDraftInit } from "./load-draft-store";
import { LoadPlanShell } from "./load-plan-shell";

export default async function LoadPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: legId } = await params;

  const leg = await db.flightLeg.findUnique({
    where: { id: legId },
    include: {
      flight: { include: { aircraft: true } },
      fromStation: true,
      toStation: true,
      loadPlans: { orderBy: { version: "desc" }, take: 1, include: { loadItems: true } },
      fuelRecord: true,
    },
  });
  if (!leg) notFound();

  const ahmData = await getLoadPlanAhmData(leg.flight.aircraft.ahmDataRef);

  const latestPlan = leg.loadPlans[0] ?? null;

  const initialDraft: LoadDraftInit = {
    items: (latestPlan?.loadItems ?? []).map((li) => ({
      position: li.position,
      weight: li.weight.toString(),
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
    cockpitCrew: latestPlan?.cockpitCrew ?? null,
    courierCrew: latestPlan?.courierCrew ?? null,
  };

  return (
    <LoadPlanShell
      legId={leg.id}
      flightNo={leg.flight.flightNo}
      registration={leg.flight.aircraft.registration}
      fromIata={leg.fromStation.iata}
      toIata={leg.toStation.iata}
      ahmData={ahmData}
      initialDraft={initialDraft}
      planVersion={latestPlan?.version ?? 0}
      planStatus={latestPlan?.status ?? null}
    />
  );
}
