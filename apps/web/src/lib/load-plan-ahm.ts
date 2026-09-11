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

/** Thrown when an aircraft has no approved AHM data set. Distinct from a
 * generic lookup failure so the UI can say *why* rather than showing a
 * stack trace: this aircraft simply cannot have a load plan yet. */
export class AhmDataNotAvailableError extends Error {
  constructor(public readonly ahmDataRef: string) {
    super(
      ahmDataRef.trim() === ""
        ? "This aircraft has no AHM data reference, so no weight and balance can be calculated for it."
        : `No approved AHM data set is loaded for "${ahmDataRef}".`,
    );
    this.name = "AhmDataNotAvailableError";
  }
}

export async function resolveAhmDocumentForAircraft(ahmDataRef: string) {
  // A fleet aircraft can exist without approved AHM data (see the seed's
  // fleetWithoutAhm). Refusing here is the point: falling through would let
  // a load plan be calculated against another aircraft's numbers.
  if (ahmDataRef.trim() === "") throw new AhmDataNotAvailableError(ahmDataRef);

  const aircraftType = aircraftTypeFromRef(ahmDataRef);
  const doc = await db.ahmDocument.findFirst({
    where: { aircraftType },
    orderBy: [{ edition: "desc" }, { revision: "desc" }],
  });
  if (!doc) throw new AhmDataNotAvailableError(ahmDataRef);
  return doc;
}

export async function getLoadPlanAhmData(
  ahmDataRef: string,
  /** Which airframe's basic weight and DOW/DOI column to surface. Optional
   * so existing callers keep working; the breakdown falls back to the first
   * published registration when it is not given. */
  registration?: string,
): Promise<LoadPlanAhmData> {
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
    cargoIndexTable: ahm.cargoIndexTable
      ? { brackets: ahm.cargoIndexTable.brackets, max: ahm.cargoIndexTable.max }
      : null,
    positionConfigurations:
      ahm.positionConfigurations?.configurations.map((c) => ({
        id: c.id,
        label: c.label,
        deck: c.deck,
        longitudinalInches: c.longitudinalInches,
        lateralInches: c.lateralInches,
        lateralPlacement: c.lateralPlacement,
      })) ?? null,
    halfContainerPositions: ahm.positionConfigurations?.halfContainerPositions ?? [],
    lateralImbalance: ahm.lateralImbalance
      ? {
          limit: ahm.lateralImbalance.limit,
          operationalMargin: ahm.lateralImbalance.operationalMargin,
          payload: ahm.lateralImbalance.payload.map((p) => ({ category: p.category, yArm: p.yArm })),
          // False while FUEL LATERAL MOMENT PER TANK TABLE is untranscribed —
          // AHM560_ERRATA.md Kayıt 10. The check stays NOT_AVAILABLE.
          fuelDataAvailable: ahm.lateralImbalance.fuel.status !== "SOURCE_NOT_TRANSCRIBED",
        }
      : null,
    uldTares: Object.fromEntries(ahm.uldTypes.types.map((t) => [t.typeCode, t.tareWeight])),
    dowDoiBreakdown: buildDowDoiBreakdown(ahm, registration, doc.edition, doc.revision),
  };
}

/**
 * The DOW/DOI matrix column for one airframe, shaped for the breakdown
 * screen. Nothing is computed here — the published cells are passed through
 * and the crew weights come from the matrix file's own remark, so the UI
 * never hardcodes an AHM constant (CLAUDE.md rule #3).
 */
function buildDowDoiBreakdown(
  ahm: ReturnType<typeof loadAhmData>,
  registration: string | undefined,
  edition: number,
  revision: number,
): LoadPlanAhmData["dowDoiBreakdown"] {
  const published = ahm.aircraft.registrations;
  const airframe = published.find((r) => r.registration === registration) ?? published[0]!;
  const cells = ahm.dowDoiMatrix[airframe.registration as "EZ-F429" | "EZ-F430"] ?? [];

  const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

  return {
    registration: airframe.registration,
    edition,
    revision,
    bew: airframe.bew,
    bewCgMac: airframe.bewCgMac,
    bewIndex: airframe.bewIndex,
    crewWeights: {
      cockpitKg: ahm.dowDoiMatrix.crewWeights.cockpitKg,
      courierKg: ahm.dowDoiMatrix.crewWeights.courierKg,
    },
    cockpitOptions: unique(cells.map((c) => c.cockpitCrew)),
    courierOptions: unique(cells.map((c) => c.courierCrew)),
    cells,
  };
}
