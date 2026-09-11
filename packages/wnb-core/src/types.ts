/**
 * @tua/wnb-core — domain types.
 *
 * Every numeric AHM constant enters this package as a decimal string
 * (never a bare `number`) and is converted to `Decimal` at the boundary
 * of each function — see CLAUDE.md rule #2. Nothing in this file, or any
 * file in this package, may hardcode an AHM value: all of the shapes
 * below are *parameters*, sourced by the caller from `@tua/ahm-data`.
 */

export type Direction = "UP" | "DOWN";
export type Deck = "MAIN" | "LOWER";
export type WnbPhase = "ZFW" | "TOW" | "LDW";

// ---------------------------------------------------------------------------
// AHM reference data shapes (mirror @tua/ahm-data's zod schemas structurally,
// but wnb-core does not depend on @tua/ahm-data — see CLAUDE.md rule #1).
// ---------------------------------------------------------------------------

export interface IndexFormula {
  refSta: string;
  k: string;
  c: string;
  /** Precomputed Ref.Sta - LEMAC, in meters. */
  refStaMinusLemac: string;
  /** Precomputed MAC/100. */
  macOver100: string;
}

export interface StabTrimPoint {
  mac: string;
  stab: string;
  direction: Direction;
}

export interface StabRoundingRule {
  method: "TRUNCATE";
  decimals: number;
}

export interface Position {
  code: string;
  deck: Deck;
  uldType: string;
  maxGross: string;
  indexPerKg: string;
}

// ---------------------------------------------------------------------------
// cargo-index-table.json — the printed "CARGO LOADING INDEX TABLE" card.
// Cross-check only; never an input to a calculation. See cargo-index-table.ts.
// ---------------------------------------------------------------------------

export interface CargoIndexBracket {
  /** Inclusive lower bound of the printed kg bracket, e.g. "1", "501". */
  from: string;
  /** Inclusive upper bound, e.g. "500", "1000". */
  to: string;
  /** Index units keyed by the card's zone letter (A..U, skipping I/N/O/Q).
   * A zone is absent when the card leaves that cell blank, i.e. the bracket
   * is above that zone's maximum load. */
  index: Record<string, string>;
}

export interface CargoIndexTable {
  brackets: CargoIndexBracket[];
  /** The card's MAX row — the index at each zone's maximum load. */
  max: Record<string, string>;
}

export interface FuelIndexRow {
  fuelWeight: string; // decimal string, or the literal "FULL"
  index: string;
}

/** Keyed by density string, e.g. "0.760" .. "0.830". */
export type FuelIndexTable = Record<string, FuelIndexRow[]>;

export interface CgBreakpoint {
  weight: string;
  index: string;
}

export interface CgLimitCurve {
  forward: CgBreakpoint[];
  aft: CgBreakpoint[];
}

export interface CgLimits {
  zfw: CgLimitCurve;
  takeoff: CgLimitCurve;
  landing: CgLimitCurve;
}

export type ZoneGroup = "FWD_CANTILEVER" | "WING_BOX" | "AFT_CANTILEVER";
export type CumulativeDirection = "FWD_TO_AFT" | "AFT_TO_FWD";

export interface CombinedLoadZone {
  zone: string;
  group: ZoneGroup;
  hArm: string | null;
  cumulativeDirection: CumulativeDirection | null;
  /** Band label (e.g. "24<=ZFCG<24.5") -> max cumulative load in kg. Null for unlimited (wing box). */
  limits: Record<string, string> | null;
}

export interface Compartment {
  number: number;
  description: string;
  maxGrossPair: string;
  pairedWith: number | null;
  indexPerKg: string;
  lirSubLimit: string;
}

export interface ZoneFactor {
  zone: string;
  factor: string;
}

export interface LongPalletDistribution {
  position: string;
  distribution: ZoneFactor[];
}

export interface DowDoiCell {
  cockpitCrew: number;
  courierCrew: number;
  dow: string;
  doi: string;
}

export interface WeightLimits {
  mtw: string;
  mtow: string;
  mlw: string;
  mzfw: string;
  min: string;
}

// ---------------------------------------------------------------------------
// Load / flight input shapes
// ---------------------------------------------------------------------------

export interface LoadItem {
  /** Position code, e.g. "ABL", "12P", "52". Must exist in the `positions` array passed to calculateWnb. */
  position: string;
  weight: string;
  uldCode?: string;
  awb?: string;
  /** B/C/M/P/S/E — baggage/cargo/mail/pallet/rummage/equipment, per AHM 560 LIR codes. */
  contentCode?: string;
}

export interface FuelState {
  density: string;
  takeoffFuel: string;
  tripFuel: string;
  taxiFuel: string;
}

export interface LmcChange {
  position: string;
  /** Positive = load added, negative = load removed. */
  weightDelta: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// calculateWnb input / output
// ---------------------------------------------------------------------------

export interface WnbInput {
  weightLimits: WeightLimits;
  dow: string;
  doi: string;
  loadItems: LoadItem[];
  positions: Position[];
  fuel: FuelState;
  fuelIndexTable: FuelIndexTable;
  indexFormula: IndexFormula;
  stabCurve: StabTrimPoint[];
  stabRounding: StabRoundingRule;
}

export interface StabResult {
  value: string;
  direction: Direction;
}

export interface WnbResult {
  ttl: string;
  zfw: string;
  tow: string;
  ldw: string;
  taxiWeight: string;
  dow: string;
  doi: string;
  lizfw: string;
  litow: string;
  lilaw: string;
  maczfw: string;
  mactow: string;
  maclaw: string;
  stab: StabResult;
  underloadBeforeLmc: string;
  fuelIndex: {
    takeoff: string;
    trip: string;
  };
}

// ---------------------------------------------------------------------------
// Check function results
// ---------------------------------------------------------------------------

export interface EnvelopeCheck {
  phase: WnbPhase;
  weight: string;
  index: string;
  forwardLimit: string;
  aftLimit: string;
  withinEnvelope: boolean;
}

export interface CombinedLoadZoneResult {
  zone: string;
  cumulativeLoad: string;
  limit: string | null;
  withinLimit: boolean;
}

export interface CombinedLoadCheck {
  zfcg: string;
  band: string;
  zones: CombinedLoadZoneResult[];
  allWithinLimit: boolean;
}

export interface LimitCheck {
  target: string;
  actual: string;
  max: string;
  withinLimit: boolean;
}

// ---------------------------------------------------------------------------
// AHM 560 Appendix I plate — LOAD AND TRIM SHEET pages 2 and 3.
// Mirrors @tua/ahm-data's schemas structurally; wnb-core never imports it.
// ---------------------------------------------------------------------------

export type LateralPlacement = "CENTRE" | "PAIRED_LEFT_RIGHT" | "CENTRE_OR_PAIRED_LEFT_RIGHT";

/** One printed row of the plate's main/lower deck position diagram. */
export interface PositionConfiguration {
  id: string;
  label: string;
  deck: Deck;
  /** Fore-aft extent of the ULD in inches. `null` for bulk, which the plate
   * gives no footprint for — bulk positions never take part in a conflict. */
  longitudinalInches: string | null;
  lateralInches: string | null;
  lateralPlacement: LateralPlacement;
}

/** One main-deck loading zone of the LOADING ZONES H-arm TABLE. */
export interface LoadingZoneHArm {
  zone: string;
  frontHArm: string;
  rearHArm: string;
}

/** LATERAL IMBALANCE CAUTION — the payload half plus the printed constants. */
export interface LateralImbalanceLimits {
  limit: string;
  operationalMargin: string;
  payload: { category: SideBySideCategory; yArm: string }[];
  /** False while FUEL LATERAL MOMENT PER TANK TABLE is untranscribed — the
   * check then has no fuel term and must not claim a total. */
  fuelDataAvailable: boolean;
}

export type SideBySideCategory = "MAIN_SBS_88" | "MAIN_SBS_96" | "LOWER_LD3";

export type FuelTankName = "INNER" | "OUTER" | "CENTER" | "TRIM";

/** FUEL INDEX PER TANK TABLE. Provisional — see AHM560_ERRATA.md Kayıt 10. */
export interface FuelTankIndexTable {
  tanks: Record<string, { perTank: boolean; step: Record<string, FuelIndexRow[]>; full: Record<string, string> }>;
  /** True while the table is a single reading of an illegible scan. A
   * consumer must refuse to calculate from it while this is set. */
  provisional: boolean;
}

// ---------------------------------------------------------------------------
// Position footprints and conflicts
// ---------------------------------------------------------------------------

export type LateralSide = "CENTRE" | "LEFT" | "RIGHT";

/** A position's fore-aft extent on its deck, in metres from the nose datum. */
export interface PositionFootprint {
  /** `${uldType}/${code}` — a code alone is ambiguous across configurations. */
  key: string;
  code: string;
  uldType: string;
  deck: Deck;
  from: string;
  to: string;
  side: LateralSide;
}

export interface PositionConflict {
  a: string;
  b: string;
  deck: Deck;
  /** Length of the shared floor, in metres. */
  overlap: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Fuel tank allocation
// ---------------------------------------------------------------------------

export interface TankAllocation {
  tank: FuelTankName;
  side: LateralSide;
  weight: string;
}

export interface TankAllocationCheck {
  total: string;
  allocated: string;
  /** allocated - total; zero when the allocation is exact. */
  difference: string;
  balanced: boolean;
  errors: string[];
  /** Left-minus-right weight difference per paired tank, informational. */
  asymmetry: { tank: FuelTankName; difference: string }[];
}

// ---------------------------------------------------------------------------
// Check function results
// ---------------------------------------------------------------------------

export interface LateralImbalanceRow {
  category: SideBySideCategory;
  leftWeight: string;
  rightWeight: string;
  difference: string;
  yArm: string;
  moment: string;
}

export type ImbalanceCheck =
  | {
      status: "NOT_AVAILABLE";
      reason: string;
      /** Present when the payload half could be computed but the fuel half
       * could not — informational only, never a pass/fail. */
      payloadRows?: LateralImbalanceRow[];
      payloadMoment?: string;
    }
  | {
      status: "OK" | "EXCEEDED";
      detail: string;
      payloadRows: LateralImbalanceRow[];
      payloadMoment: string;
      fuelMoment: string;
      totalWithoutMargin: string;
      operationalMargin: string;
      totalWithMargin: string;
      limit: string;
    };
