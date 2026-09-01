/**
 * Server-only: loads the AHM 560 data slice a load-plan session needs,
 * via @tua/ahm-data's fs-based loader. Never import this from a "use
 * client" component — see load-plan-calc.ts for the client-safe half
 * (which takes this module's output as a plain-data prop instead).
 */

import { loadAhmData } from "@tua/ahm-data";
import { db } from "@tua/db";
import type { LoadPlanAhmData } from "./load-plan-calc";

/** Aircraft.ahmDataRef looks like "a330-243p2f/ed1-rev0" — a display
 * convenience (see schema.prisma's comment on the field), not a foreign
 * key. Only the aircraftType prefix is used here to find the latest
 * AhmDocument for that type. */
function aircraftTypeFromRef(ahmDataRef: string): string {
  return ahmDataRef.split("/")[0] ?? ahmDataRef;
}

export async function resolveAhmDocumentForAircraft(ahmDataRef: string) {
  const aircraftType = aircraftTypeFromRef(ahmDataRef);
  return db.ahmDocument.findFirstOrThrow({
    where: { aircraftType },
    orderBy: [{ edition: "desc" }, { revision: "desc" }],
  });
}

export async function getLoadPlanAhmData(ahmDataRef: string): Promise<LoadPlanAhmData> {
  const doc = await resolveAhmDocumentForAircraft(ahmDataRef);
  const ahm = loadAhmData(doc.aircraftType, doc.edition, doc.revision);

  return {
    ahmDocumentId: doc.id,
    weightLimits: ahm.aircraft.weightLimits,
    positions: ahm.positions.positions,
    compartments: ahm.compartments.compartments,
    mainDeckMaxLoad: ahm.compartments.mainDeckMaxLoad,
    longPalletDistribution: ahm.zoneMapping.longPalletDistribution,
    combinedLoadZones: ahm.combinedLoad.zones,
    cgLimits: ahm.cgLimits,
    fuelIndexTable: ahm.fuelIndex,
    indexFormula: {
      refSta: ahm.indexFormula.refSta,
      k: ahm.indexFormula.k,
      c: ahm.indexFormula.c,
      refStaMinusLemac: ahm.indexFormula.derived.refStaMinusLemac,
      macOver100: ahm.indexFormula.derived.macOver100,
    },
    stabCurve: ahm.indexFormula.stabTrimCurve,
    stabRounding: {
      method: ahm.indexFormula.roundingRules.stab.method,
      decimals: ahm.indexFormula.roundingRules.stab.decimals,
    },
    dowDoiMatrix: { "EZ-F429": ahm.dowDoiMatrix["EZ-F429"], "EZ-F430": ahm.dowDoiMatrix["EZ-F430"] },
    cockpitMaxSeats: ahm.crewIndex.cockpit.maxSeats,
    courierMaxSeats: ahm.crewIndex.courier.reduce((sum, c) => sum + c.maxSeats, 0),
  };
}
