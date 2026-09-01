/**
 * Client-safe load-plan calculation layer — pure functions over plain
 * data, only importing @tua/wnb-core (zero framework/fs dependency).
 * Never import @tua/ahm-data or @tua/db here — see load-plan-ahm.ts for
 * the server-only half that produces `LoadPlanAhmData`.
 *
 * Runs identically on the server (initial render, save action) and in
 * the browser (live recalculation on every edit, debounced — Faz 8's
 * "canlı W&B paneli").
 */

import { Decimal } from "decimal.js";
import {
  calculateWnb,
  checkCombinedLoad,
  checkCompartmentLimits,
  checkEnvelope,
  checkLateralImbalance,
  expandLoadToZones,
  getDowDoi,
  ZfcgOutOfRangeError,
  WnbError,
  type CgLimits,
  type CombinedLoadCheck,
  type CombinedLoadZone,
  type Compartment,
  type DowDoiCell,
  type EnvelopeCheck,
  type FuelIndexTable,
  type FuelState,
  type ImbalanceCheck,
  type IndexFormula,
  type LimitCheck,
  type LongPalletDistribution,
  type Position,
  type StabRoundingRule,
  type StabTrimPoint,
  type WeightLimits,
  type WnbResult,
} from "@tua/wnb-core";

export interface LoadPlanAhmData {
  ahmDocumentId: string;
  weightLimits: WeightLimits;
  positions: Position[];
  compartments: Compartment[];
  mainDeckMaxLoad: string;
  longPalletDistribution: LongPalletDistribution[];
  combinedLoadZones: CombinedLoadZone[];
  cgLimits: CgLimits;
  fuelIndexTable: FuelIndexTable;
  indexFormula: IndexFormula;
  stabCurve: StabTrimPoint[];
  stabRounding: StabRoundingRule;
  dowDoiMatrix: Record<string, DowDoiCell[]>;
  cockpitMaxSeats: number;
  courierMaxSeats: number;
}

export interface DraftLoadItem {
  position: string;
  weight: string;
  uldCode?: string;
  awb?: string;
  contentCode?: string;
  /** Disambiguates positions with multiple size variants — see LoadItem.uldType's schema comment. */
  uldType?: string;
}

export interface LoadPlanDraft {
  items: DraftLoadItem[];
  fuel: FuelState;
  cockpitCrew: number | null;
  courierCrew: number | null;
}

/**
 * `ahmData.positions` legitimately has more than one entry for some codes
 * (one per uldType variant — see LoadItem.uldType's schema comment).
 * calculateWnb needs exactly one entry per code: the variant actually
 * occupying that position, or (for an unoccupied/undecided position) an
 * arbitrary but stable default so max-gross display still has a value.
 */
export function resolvePositions(allPositions: Position[], items: DraftLoadItem[]): Position[] {
  const variantByCode = new Map<string, string>();
  for (const item of items) {
    if (item.uldType) variantByCode.set(item.position, item.uldType);
  }

  const chosen = new Map<string, Position>();
  for (const pos of allPositions) {
    const wantedVariant = variantByCode.get(pos.code);
    if (wantedVariant) {
      if (pos.uldType === wantedVariant) chosen.set(pos.code, pos);
      continue;
    }
    // No explicit variant chosen yet — keep the first one seen (stable default).
    if (!chosen.has(pos.code)) chosen.set(pos.code, pos);
  }
  return [...chosen.values()];
}

export interface PositionOverload {
  position: string;
  actual: string;
  max: string;
}

export type DowDoiResult = { available: true; dow: string; doi: string } | { available: false; reason: string };
export type CombinedLoadResult = { available: true; check: CombinedLoadCheck } | { available: false; reason: string };
export type BlockingError = { code: string; message: string };

export interface LiveWnbResult {
  positions: Position[];
  dowDoi: DowDoiResult;
  wnb: WnbResult | null;
  blockingError: BlockingError | null;
  envelope: {
    zfw: EnvelopeCheck;
    tow: EnvelopeCheck;
    ldw: EnvelopeCheck;
    /** True when no landing CG table is published (AHM 560 gap — GROUND_TRUTH.md §21 Q3) and the ZFW curve was used as a stand-in for LDW. */
    landingIsApproximate: boolean;
  } | null;
  positionOverloads: PositionOverload[];
  compartments: LimitCheck[];
  combinedLoad: CombinedLoadResult;
  lateralImbalance: ImbalanceCheck;
  allWithinEnvelope: boolean;
}

function checkPositionOverloads(items: DraftLoadItem[], positions: Position[]): PositionOverload[] {
  const byCode = new Map(positions.map((p) => [p.code, p]));
  const totals = new Map<string, Decimal>();
  for (const item of items) {
    totals.set(item.position, (totals.get(item.position) ?? new Decimal(0)).plus(new Decimal(item.weight)));
  }
  const overloads: PositionOverload[] = [];
  for (const [position, actual] of totals) {
    const pos = byCode.get(position);
    if (!pos) continue;
    if (actual.gt(new Decimal(pos.maxGross))) {
      overloads.push({ position, actual: actual.toString(), max: pos.maxGross });
    }
  }
  return overloads;
}

export function computeLiveWnb(draft: LoadPlanDraft, ahmData: LoadPlanAhmData, registration: string): LiveWnbResult {
  const positions = resolvePositions(ahmData.positions, draft.items);

  let dowDoi: DowDoiResult;
  if (draft.cockpitCrew === null || draft.courierCrew === null) {
    dowDoi = { available: false, reason: "crewNotSet" };
  } else {
    try {
      const matrix = ahmData.dowDoiMatrix[registration] ?? [];
      const cell = getDowDoi(registration, draft.cockpitCrew, draft.courierCrew, matrix);
      dowDoi = { available: true, ...cell };
    } catch (err) {
      dowDoi = { available: false, reason: err instanceof WnbError ? err.message : "dowDoiNotFound" };
    }
  }

  const positionOverloads = checkPositionOverloads(draft.items, positions);

  if (!dowDoi.available) {
    return {
      positions,
      dowDoi,
      wnb: null,
      blockingError: { code: "DOW_DOI_NOT_FOUND", message: dowDoi.reason },
      envelope: null,
      positionOverloads,
      compartments: [],
      combinedLoad: { available: false, reason: "dowDoiNotSet" },
      lateralImbalance: checkLateralImbalance(draft.items, draft.fuel),
      allWithinEnvelope: false,
    };
  }

  let wnb: WnbResult;
  try {
    wnb = calculateWnb({
      weightLimits: ahmData.weightLimits,
      dow: dowDoi.dow,
      doi: dowDoi.doi,
      loadItems: draft.items,
      positions,
      fuel: draft.fuel,
      fuelIndexTable: ahmData.fuelIndexTable,
      indexFormula: ahmData.indexFormula,
      stabCurve: ahmData.stabCurve,
      stabRounding: ahmData.stabRounding,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "calculateWnb failed";
    const code = err instanceof WnbError ? err.name : "UNKNOWN";
    return {
      positions,
      dowDoi,
      wnb: null,
      blockingError: { code, message },
      envelope: null,
      positionOverloads,
      compartments: [],
      combinedLoad: { available: false, reason: "calculationFailed" },
      lateralImbalance: checkLateralImbalance(draft.items, draft.fuel),
      allWithinEnvelope: false,
    };
  }

  const landingCurve = ahmData.cgLimits.landing.forward.length > 0 ? ahmData.cgLimits.landing : ahmData.cgLimits.zfw;
  let envelope: LiveWnbResult["envelope"];
  try {
    envelope = {
      zfw: checkEnvelope(wnb.zfw, wnb.lizfw, "ZFW", ahmData.cgLimits.zfw),
      tow: checkEnvelope(wnb.tow, wnb.litow, "TOW", ahmData.cgLimits.takeoff),
      ldw: checkEnvelope(wnb.ldw, wnb.lilaw, "LDW", landingCurve),
      landingIsApproximate: ahmData.cgLimits.landing.forward.length === 0,
    };
  } catch (err) {
    // A weight outside the published CG table's range (e.g. ZFW below the
    // table's minimum before enough load has been entered yet) — not a
    // violation, just "not enough data to check yet".
    const message = err instanceof Error ? err.message : "envelope check failed";
    return {
      positions,
      dowDoi,
      wnb,
      blockingError: { code: "ENVELOPE_RANGE", message },
      envelope: null,
      positionOverloads,
      compartments: [],
      combinedLoad: { available: false, reason: "envelopeRangeError" },
      lateralImbalance: checkLateralImbalance(draft.items, draft.fuel),
      allWithinEnvelope: false,
    };
  }

  const compartments = checkCompartmentLimits(draft.items, positions, ahmData.compartments, ahmData.mainDeckMaxLoad);

  let combinedLoad: CombinedLoadResult;
  try {
    const loadByZone = expandLoadToZones(draft.items, ahmData.longPalletDistribution);
    combinedLoad = { available: true, check: checkCombinedLoad(loadByZone, wnb.maczfw, ahmData.combinedLoadZones) };
  } catch (err) {
    combinedLoad = {
      available: false,
      reason: err instanceof ZfcgOutOfRangeError ? err.message : "combinedLoadUnavailable",
    };
  }

  const lateralImbalance = checkLateralImbalance(draft.items, draft.fuel);

  return {
    positions,
    dowDoi,
    wnb,
    blockingError: null,
    envelope,
    positionOverloads,
    compartments,
    combinedLoad,
    lateralImbalance,
    allWithinEnvelope: envelope.zfw.withinEnvelope && envelope.tow.withinEnvelope && envelope.ldw.withinEnvelope,
  };
}
