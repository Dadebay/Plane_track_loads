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
  calculatePositionIndexes,
  calculateWnb,
  checkCombinedLoad,
  checkCompartmentLimits,
  checkEnvelope,
  checkLateralImbalance,
  collectSideBySideLoads,
  crossCheckCargoIndexCard,
  buildPositionFootprints,
  findPositionConflicts,
  positionKey,
  expandLoadToZones,
  getDowDoi,
  ZfcgOutOfRangeError,
  WnbError,
  type CgLimits,
  type CombinedLoadCheck,
  type CargoIndexTable,
  type CombinedLoadZone,
  type Compartment,
  type CardCrossCheck,
  type DowDoiCell,
  type EnvelopeCheck,
  type FuelIndexTable,
  type FuelState,
  type ImbalanceCheck,
  type IndexFormula,
  type LimitCheck,
  type LateralImbalanceLimits,
  type LongPalletDistribution,
  type Position,
  type PositionConfiguration,
  type PositionConflict,
  type PositionFootprint,
  type PositionIndexBreakdown,
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
  /** The printed CARGO LOADING INDEX TABLE card, for the side-by-side
   * cross-check in the position list. `null` for a revision whose card page
   * we do not hold — the computed index is shown on its own. */
  cargoIndexTable: CargoIndexTable | null;
  /** The plate's position rows, used to derive footprints and therefore
   * which positions are mutually exclusive. `null` for a revision whose
   * plate page we do not hold — conflicts are then not checked. */
  positionConfigurations: PositionConfiguration[] | null;
  /** Lower-deck codes that also exist as L/R half units. */
  halfContainerPositions: string[];
  /** LATERAL IMBALANCE CAUTION constants. `null` for a revision without the
   * plate; `fuelDataAvailable` false while the fuel table is untranscribed. */
  lateralImbalance: LateralImbalanceLimits | null;
  /** ULD type code -> printed tare weight, from uld-types.json. Lets the
   * server derive gross from a picked ULD instead of trusting the client. */
  uldTares: Record<string, string>;
  /** True only when this revision publishes tank data that a calculation
   * may use — i.e. `fuel-tank-index.json` exists and is no longer
   * provisional. False today (AHM560_ERRATA.md Kayıt 10): the approved
   * source publishes no refuelling schedule and the per-tank index page is
   * untranscribed, so a tank split is a record of what the crew did, not an
   * input to anything. */
  tankFuelDataUsable: boolean;
  /** Where this flight's DOW/DOI comes from, for the breakdown screen.
   * Read-only: the published cell is the authority, never rebuilt here. */
  dowDoiBreakdown: DowDoiBreakdown;
}

/**
 * The published DOW/DOI matrix for one registration, plus everything needed
 * to explain a cell: the printed per-occupant crew weights that make it
 * decomposable, and the airframe's basic weight as `aircraft.json` holds it.
 *
 * `bew` is shown, never calculated from — see AHM560_ERRATA.md Kayıt 11.
 */
export interface DowDoiBreakdown {
  registration: string;
  edition: number;
  revision: number;
  bew: string;
  bewCgMac: string;
  bewIndex: string;
  crewWeights: { cockpitKg: string; courierKg: string };
  cockpitOptions: number[];
  courierOptions: number[];
  cells: DowDoiCell[];
}

export interface DraftLoadItem {
  position: string;
  /** Gross. Derived from tare + net when both are entered; the server
   * re-derives it and never trusts this value. */
  weight: string;
  tareWeight?: string;
  netWeight?: string;
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
  /** Per-position index units, live as the loadmaster types. Computed
   * independently of DOW/DOI so the index still shows before a crew
   * version has been picked. */
  positionIndexes: PositionIndexBreakdown;
  /** Each loaded zone's exact index against the printed CARGO LOADING INDEX
   * TABLE card. Empty when this AHM revision carries no card. */
  cardIndexRows: CardCrossCheck[];
  compartments: LimitCheck[];
  combinedLoad: CombinedLoadResult;
  lateralImbalance: ImbalanceCheck;
  /** Pairs of loaded positions that share floor. Empty when this AHM
   * revision carries no position plate. */
  positionConflicts: PositionConflict[];
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

/**
 * Per-position index units plus the printed-card cross-check.
 *
 * Deliberately tolerant: a draft can transiently name a position the
 * resolved set does not contain (an item saved against a variant the user
 * has since switched away from), and that must not blank the whole panel —
 * `calculateWnb` will still surface it as a hard error when the plan is
 * saved.
 */
function computePositionIndexes(
  draft: LoadPlanDraft,
  ahmData: LoadPlanAhmData,
  positions: Position[],
): { indexes: PositionIndexBreakdown; card: CardCrossCheck[] } {
  const known = new Set(positions.map((p) => p.code));
  const items = draft.items.filter((i) => known.has(i.position) && i.weight !== "");

  let indexes: PositionIndexBreakdown;
  try {
    indexes = calculatePositionIndexes(items, positions);
  } catch {
    indexes = { rows: [], totalIndex: "0.00", totalWeight: "0" };
  }

  if (!ahmData.cargoIndexTable) return { indexes, card: [] };

  try {
    const zones = expandLoadToZones(items, ahmData.longPalletDistribution);
    return { indexes, card: crossCheckCargoIndexCard(zones, positions, ahmData.cargoIndexTable) };
  } catch {
    return { indexes, card: [] };
  }
}


/**
 * Positions that share floor with another loaded position — AHM 560
 * Appendix I s.74's alternative row configurations, resolved by footprint
 * overlap in wnb-core. Returns nothing when this AHM revision carries no
 * position plate, rather than pretending the load is conflict-free.
 */
function computePositionConflicts(draft: LoadPlanDraft, ahmData: LoadPlanAhmData): PositionConflict[] {
  if (!ahmData.positionConfigurations) return [];
  const footprints: PositionFootprint[] = buildPositionFootprints(
    ahmData.positions,
    ahmData.positionConfigurations,
    ahmData.indexFormula,
    ahmData.halfContainerPositions,
  );
  const occupied = draft.items
    .filter((item) => item.weight !== "")
    .map((item) => {
      // A code with only one variant carries no uldType on the draft item;
      // look it up so the footprint key is complete either way.
      const uldType = item.uldType ?? ahmData.positions.find((p) => p.code === item.position)?.uldType;
      return uldType ? positionKey(uldType, item.position) : null;
    })
    .filter((key): key is string => key !== null);
  return findPositionConflicts(occupied, footprints);
}

/** The lateral imbalance check, fed from the load plan. Still reports
 * NOT_AVAILABLE with today's data — the fuel half of the source table is
 * untranscribed (AHM560_ERRATA.md Kayıt 10) — but the payload rows it
 * returns are shown to the controller as provisional information. */
function computeLateralImbalance(draft: LoadPlanDraft, ahmData: LoadPlanAhmData): ImbalanceCheck {
  if (!ahmData.positionConfigurations) {
    return checkLateralImbalance({ sideBySide: [], limits: null });
  }
  const sideBySide = collectSideBySideLoads(
    draft.items.filter((item) => item.weight !== ""),
    ahmData.positions,
    ahmData.positionConfigurations,
  );
  return checkLateralImbalance({ sideBySide, limits: ahmData.lateralImbalance });
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
  const positionConflicts = computePositionConflicts(draft, ahmData);
  const lateralImbalanceCheck = computeLateralImbalance(draft, ahmData);
  const { indexes: positionIndexes, card: cardIndexRows } = computePositionIndexes(draft, ahmData, positions);

  if (!dowDoi.available) {
    return {
      positions,
      dowDoi,
      wnb: null,
      blockingError: { code: "DOW_DOI_NOT_FOUND", message: dowDoi.reason },
      envelope: null,
      positionOverloads,
      positionConflicts,
      positionIndexes,
      cardIndexRows,
      compartments: [],
      combinedLoad: { available: false, reason: "dowDoiNotSet" },
      lateralImbalance: lateralImbalanceCheck,
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
    // A stable code, not `err.name`: class names survive dev but can be
    // mangled by a production minifier, and the UI translates on this
    // value (wnb-panel.tsx). Unmapped engine errors keep their English
    // message rather than being flattened into a generic failure.
    const code =
      err instanceof ZfcgOutOfRangeError
        ? "ZFCG_OUT_OF_RANGE"
        : err instanceof WnbError
          ? err.name
          : "UNKNOWN";
    return {
      positions,
      dowDoi,
      wnb: null,
      blockingError: { code, message },
      envelope: null,
      positionOverloads,
      positionConflicts,
      positionIndexes,
      cardIndexRows,
      compartments: [],
      combinedLoad: { available: false, reason: "calculationFailed" },
      lateralImbalance: lateralImbalanceCheck,
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
      positionConflicts,
      positionIndexes,
      cardIndexRows,
      compartments: [],
      combinedLoad: { available: false, reason: "envelopeRangeError" },
      lateralImbalance: lateralImbalanceCheck,
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

  const lateralImbalance = lateralImbalanceCheck;

  return {
    positions,
    dowDoi,
    wnb,
    blockingError: null,
    envelope,
    positionOverloads,
    positionConflicts,
    positionIndexes,
    cardIndexRows,
    compartments,
    combinedLoad,
    lateralImbalance,
    allWithinEnvelope: envelope.zfw.withinEnvelope && envelope.tow.withinEnvelope && envelope.ldw.withinEnvelope,
  };
}
