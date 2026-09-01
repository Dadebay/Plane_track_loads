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

export type ImbalanceCheck =
  | { status: "NOT_AVAILABLE"; reason: string }
  | { status: "OK" | "EXCEEDED"; detail: string };
