/**
 * @tua/ahm-data — zod schemas for every versioned AHM 560 JSON file, plus
 * the loader that reads and validates them from disk.
 *
 * All numeric AHM values are kept as strings end-to-end (never `number`) so
 * that `packages/wnb-core` can hand them straight to `decimal.js` without an
 * intermediate float round-trip. See CLAUDE.md rule #2 and #3.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

// A numeric AHM value, kept as a decimal string (e.g. "111072.5", "-0.00696",
// "+1.10" — the source PDF prints explicit "+" signs in the fuel index
// tables, which the extractor preserves verbatim).
const decimalString = z.string().regex(/^[+-]?\d+(\.\d+)?$/, "expected a decimal string");

// ---------------------------------------------------------------------------
// aircraft.json
// ---------------------------------------------------------------------------

export const AircraftRegistrationSchema = z.object({
  registration: z.string(),
  bew: decimalString,
  bewCgMac: decimalString,
  bewIndex: decimalString,
  rampTaxi: decimalString,
  designTakeoffDry: decimalString,
  zeroFuel: decimalString,
  landing: decimalString,
});

export const AircraftDataSchema = z.object({
  aircraftType: z.string(),
  carrier: z.string(),
  edition: z.number().int(),
  revision: z.number().int(),
  effectiveDate: z.string(),
  approvedDate: z.string(),
  sita: z.string(),
  email: z.string(),
  units: z.object({
    weight: z.string(),
    length: z.string(),
    volume: z.string(),
    fuelDensity: z.string(),
    moment: z.string(),
  }),
  weightLimits: z.object({
    mtw: decimalString,
    mtow: decimalString,
    mlw: decimalString,
    mzfw: decimalString,
    min: decimalString,
  }),
  registrations: z.array(AircraftRegistrationSchema),
  source: z.object({
    documentTitle: z.string(),
    groundTruthRefs: z.array(z.string()),
  }),
});
export type AircraftData = z.infer<typeof AircraftDataSchema>;

// ---------------------------------------------------------------------------
// index-formula.json
// ---------------------------------------------------------------------------

export const StabTrimPointSchema = z.object({
  mac: decimalString,
  stab: decimalString,
  direction: z.enum(["UP", "DOWN"]),
});

export const IndexFormulaSchema = z.object({
  refSta: decimalString,
  k: decimalString,
  c: decimalString,
  macLength: decimalString,
  lemac: decimalString,
  derived: z.object({
    refStaMinusLemac: decimalString,
    macOver100: decimalString,
  }),
  stabTrimCurve: z.array(StabTrimPointSchema),
  roundingRules: z.object({
    stab: z.object({
      method: z.literal("TRUNCATE"),
      decimals: z.number().int(),
      note: z.string(),
    }),
  }),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type IndexFormula = z.infer<typeof IndexFormulaSchema>;

// ---------------------------------------------------------------------------
// dow-doi-matrix.json
// ---------------------------------------------------------------------------

export const DowDoiCellSchema = z.object({
  cockpitCrew: z.number().int().min(1).max(4),
  courierCrew: z.number().int().min(0).max(6),
  dow: decimalString,
  doi: decimalString,
});

export const DowDoiMatrixSchema = z.object({
  "EZ-F429": z.array(DowDoiCellSchema),
  "EZ-F430": z.array(DowDoiCellSchema),
  /** The remark printed under the matrix: per-occupant weights, baggage
   * included. They are what makes a printed cell decomposable back into a
   * basic weight — see AHM560_ERRATA.md Kayıt 11. */
  crewWeights: z.object({
    cockpitKg: decimalString,
    courierKg: decimalString,
    note: z.string(),
  }),
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type DowDoiMatrix = z.infer<typeof DowDoiMatrixSchema>;

// ---------------------------------------------------------------------------
// cg-limits.json
// ---------------------------------------------------------------------------

export const CgBreakpointSchema = z.object({
  weight: decimalString,
  index: decimalString,
});

export const CgLimitsSchema = z.object({
  zfw: z.object({
    forward: z.array(CgBreakpointSchema),
    aft: z.array(CgBreakpointSchema),
  }),
  takeoff: z.object({
    forward: z.array(CgBreakpointSchema),
    aft: z.array(CgBreakpointSchema),
  }),
  landing: z.object({
    note: z.string(),
    forward: z.array(CgBreakpointSchema),
    aft: z.array(CgBreakpointSchema),
  }),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type CgLimits = z.infer<typeof CgLimitsSchema>;

// ---------------------------------------------------------------------------
// compartments.json
// ---------------------------------------------------------------------------

export const CompartmentSchema = z.object({
  number: z.number().int(),
  description: z.string(),
  maxGrossPair: decimalString,
  pairedWith: z.number().int().nullable(),
  indexPerKg: decimalString,
  lirSubLimit: decimalString,
});

export const CompartmentsSchema = z.object({
  compartments: z.array(CompartmentSchema),
  mainDeckMaxLoad: decimalString,
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type CompartmentsData = z.infer<typeof CompartmentsSchema>;

// ---------------------------------------------------------------------------
// positions.json
// ---------------------------------------------------------------------------

export const PositionSchema = z.object({
  code: z.string(),
  deck: z.enum(["MAIN", "LOWER"]),
  uldType: z.string(),
  maxGross: decimalString,
  indexPerKg: decimalString,
});

export const PositionsSchema = z.object({
  positions: z.array(PositionSchema),
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type PositionsData = z.infer<typeof PositionsSchema>;

// ---------------------------------------------------------------------------
// combined-load.json
// ---------------------------------------------------------------------------

export const CombinedLoadZoneSchema = z.object({
  zone: z.string(),
  group: z.enum(["FWD_CANTILEVER", "WING_BOX", "AFT_CANTILEVER"]),
  hArm: decimalString.nullable(),
  cumulativeDirection: z.enum(["FWD_TO_AFT", "AFT_TO_FWD"]).nullable(),
  limits: z.record(z.string(), decimalString).nullable(),
});

export const CombinedLoadSchema = z.object({
  zones: z.array(CombinedLoadZoneSchema),
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type CombinedLoadData = z.infer<typeof CombinedLoadSchema>;

// ---------------------------------------------------------------------------
// zone-mapping.json
// ---------------------------------------------------------------------------

export const ZoneFactorSchema = z.object({
  zone: z.string(),
  factor: decimalString,
});

export const LongPalletDistributionSchema = z.object({
  position: z.string(),
  distribution: z.array(ZoneFactorSchema),
});

export const ZoneMappingSchema = z.object({
  longPalletDistribution: z.array(LongPalletDistributionSchema),
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type ZoneMappingData = z.infer<typeof ZoneMappingSchema>;

// ---------------------------------------------------------------------------
// uld-types.json
// ---------------------------------------------------------------------------

export const UldTypeSchema = z.object({
  typeCode: z.string(),
  aliasOf: z.string().optional(),
  tareWeight: decimalString,
  grossWeight: decimalString,
  volume: decimalString,
  deck: z.enum(["MAIN", "LOWER", "LOWER_OR_MAIN"]),
});

export const BallastSchema = z.object({
  uldType: z.string(),
  grossWeight: decimalString,
});

export const UldTypesSchema = z.object({
  types: z.array(UldTypeSchema),
  ballast: z.array(BallastSchema),
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type UldTypesData = z.infer<typeof UldTypesSchema>;

// ---------------------------------------------------------------------------
// crew-index.json
// ---------------------------------------------------------------------------

export const CourierSeatSchema = z.object({
  location: z.string(),
  maxSeats: z.number().int(),
  armFromRefSta: decimalString,
  indexPerKg: decimalString,
});

export const GalleySchema = z.object({
  location: z.string(),
  armFromRefSta: decimalString,
  indexPerKg: decimalString,
});

export const CrewIndexSchema = z.object({
  cockpit: z.object({
    maxSeats: z.number().int(),
    armFromRefSta: decimalString,
    indexPerKg: decimalString,
  }),
  courier: z.array(CourierSeatSchema),
  galley: z.array(GalleySchema),
  cabinConfiguration: z.object({
    code: z.string(),
    class1: z.string(),
    courierAreaSeats: z.number().int(),
    standardCourierSplit: z.object({
      aftOfLavatory: z.number().int(),
      aftOfCourierStowage: z.number().int(),
    }),
  }),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type CrewIndexData = z.infer<typeof CrewIndexSchema>;

// ---------------------------------------------------------------------------
// fuel-index.json
// ---------------------------------------------------------------------------

export const FuelIndexRowSchema = z.object({
  // "FULL" for the tank-full row, otherwise a decimal string.
  fuelWeight: z.union([z.literal("FULL"), decimalString]),
  index: decimalString,
});

// Keyed by density string, e.g. "0.760" .. "0.830".
export const FuelIndexSchema = z.record(z.string(), z.array(FuelIndexRowSchema));
export type FuelIndexData = z.infer<typeof FuelIndexSchema>;

// ---------------------------------------------------------------------------
// cargo-index-table.json (OPTIONAL)
// ---------------------------------------------------------------------------

/** One printed kg bracket of the CARGO LOADING INDEX TABLE card, keyed by
 * the card's zone letter. A zone is absent where the card greys the cell
 * out (the bracket is above that zone's maximum load). */
export const CargoIndexBracketSchema = z.object({
  from: decimalString,
  to: decimalString,
  index: z.record(z.string(), decimalString),
});

export const CargoIndexTableSchema = z.object({
  brackets: z.array(CargoIndexBracketSchema),
  /** The card's MAX row — the index at each zone's maximum load. */
  max: z.record(z.string(), decimalString),
  notes: z.array(z.string()),
  source: z.object({ groundTruthRefs: z.array(z.string()) }),
});
export type CargoIndexTableData = z.infer<typeof CargoIndexTableSchema>;

// ---------------------------------------------------------------------------
// Appendix I plate — LOAD AND TRIM SHEET pages 2 and 3 (OPTIONAL)
// ---------------------------------------------------------------------------

/** `source` block of the Appendix I files, which also name the plate they
 * were read from — the older files carry `groundTruthRefs` alone. */
const plateSource = z.object({
  documentTitle: z.string().optional(),
  groundTruthRefs: z.array(z.string()),
});

// lmc-index-table.json — LMC INDEX TABLE
// Index change of a +100 kg last minute change, per main-deck loading zone.
export const LmcIndexTableSchema = z.object({
  perHundredKg: z.record(z.string(), decimalString),
  notes: z.array(z.string()),
  source: plateSource,
});
export type LmcIndexTableData = z.infer<typeof LmcIndexTableSchema>;

// loading-zones-harm.json — LOADING ZONES H-arm TABLE
export const LoadingZoneHArmSchema = z.object({
  zone: z.string(),
  frontHArm: decimalString,
  rearHArm: decimalString,
});

export const LoadingZonesHArmSchema = z.object({
  zones: z.array(LoadingZoneHArmSchema),
  notes: z.array(z.string()),
  source: plateSource,
});
export type LoadingZonesHArmData = z.infer<typeof LoadingZonesHArmSchema>;

// lateral-imbalance.json — LATERAL IMBALANCE CAUTION
export const LateralImbalancePayloadSchema = z.object({
  category: z.enum(["MAIN_SBS_88", "MAIN_SBS_96", "LOWER_LD3"]),
  label: z.string(),
  yArm: decimalString,
});

export const LateralImbalanceSchema = z.object({
  scope: z.literal("SIDE_BY_SIDE_PALLETS_ONLY"),
  limit: decimalString,
  operationalMargin: decimalString,
  /** The plate's printed rule: the margin always carries the sign of the
   * total imbalance without it, so it can only ever make the result worse. */
  signRule: z.literal("MARGIN_FOLLOWS_TOTAL"),
  payload: z.array(LateralImbalancePayloadSchema),
  /** The fuel half of the same table. Only ever `SOURCE_NOT_TRANSCRIBED`
   * today — see AHM560_ERRATA.md Kayıt 10. */
  fuel: z.object({
    status: z.literal("SOURCE_NOT_TRANSCRIBED"),
    tanks: z.array(z.string()),
    sourceTable: z.string(),
    sourcePage: z.string(),
    reason: z.string(),
  }),
  verification: z.object({ status: z.string(), note: z.string() }),
  notes: z.array(z.string()),
  source: plateSource,
});
export type LateralImbalanceData = z.infer<typeof LateralImbalanceSchema>;

// position-configurations.json — the plate's main/lower deck position rows.
export const ConfigurationPositionSchema = z.object({
  code: z.string(),
  maxGross: decimalString,
});

export const PositionConfigurationSchema = z.object({
  id: z.string(),
  label: z.string(),
  deck: z.enum(["MAIN", "LOWER"]),
  /** `null` for bulk, which the plate gives no ULD footprint for. */
  longitudinalInches: decimalString.nullable(),
  lateralInches: decimalString.nullable(),
  lateralPlacement: z.enum(["CENTRE", "PAIRED_LEFT_RIGHT", "CENTRE_OR_PAIRED_LEFT_RIGHT"]),
  halfSizeMaxGross: decimalString.optional(),
  fullSizeMaxGross: decimalString.optional(),
  positions: z.array(ConfigurationPositionSchema),
});

export const PositionConfigurationsSchema = z.object({
  configurations: z.array(PositionConfigurationSchema),
  halfContainerSuffixes: z.array(z.string()),
  halfContainerPositions: z.array(z.string()),
  restrictedArea: z.object({
    id: z.string(),
    fromFrame: decimalString,
    toFrame: decimalString,
    rules: z.array(z.string()),
  }),
  exclusivity: z.object({
    rule: z.literal("FOOTPRINT_OVERLAP"),
    note: z.string(),
    verifiedExamples: z.array(z.string()),
  }),
  notes: z.array(z.string()),
  source: plateSource,
});
export type PositionConfigurationsData = z.infer<typeof PositionConfigurationsSchema>;

// fuel-tank-index.json — FUEL INDEX PER TANK TABLE (PROVISIONAL)
export const FuelTankIndexRowSchema = z.object({
  fuelWeight: decimalString,
  index: decimalString,
});

/** Keyed by density string ("0.760" | "0.800" | "0.840"). */
const byDensity = <T extends z.ZodTypeAny>(inner: T) => z.record(z.string(), inner);

export const FuelTankIndexTankSchema = z.object({
  /** The plate's footnote (1): INNER and OUTER values are per tank. */
  perTank: z.boolean(),
  step: byDensity(z.array(FuelTankIndexRowSchema)),
  full: byDensity(decimalString),
});

export const FuelTankIndexSchema = z.object({
  tanks: z.record(z.string(), FuelTankIndexTankSchema),
  densities: z.array(z.string()),
  /** Always `true` today. A consumer must refuse to calculate while it is. */
  provisional: z.boolean(),
  verification: z.object({
    status: z.string(),
    method: z.string(),
    blocker: z.string(),
    flaggedCells: z.array(z.string()),
    requiredToClear: z.string(),
  }),
  notes: z.array(z.string()),
  source: plateSource,
});
export type FuelTankIndexData = z.infer<typeof FuelTankIndexSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export interface AhmDataSet {
  aircraft: AircraftData;
  indexFormula: IndexFormula;
  dowDoiMatrix: DowDoiMatrix;
  fuelIndex: FuelIndexData;
  cgLimits: CgLimits;
  compartments: CompartmentsData;
  positions: PositionsData;
  combinedLoad: CombinedLoadData;
  zoneMapping: ZoneMappingData;
  uldTypes: UldTypesData;
  crewIndex: CrewIndexData;
  /** The printed CARGO LOADING INDEX TABLE card. Optional: it is a
   * cross-check aid, never a calculation input (see wnb-core's
   * cargo-index-table.ts), and a revision we hold without that page still
   * loads. `null` when the file is absent. */
  cargoIndexTable: CargoIndexTableData | null;
  /** Appendix I plate, LOAD AND TRIM SHEET page 2. `null` for a revision
   * whose plate we do not hold — same rule as `cargoIndexTable`. */
  lmcIndexTable: LmcIndexTableData | null;
  loadingZonesHArm: LoadingZonesHArmData | null;
  lateralImbalance: LateralImbalanceData | null;
  positionConfigurations: PositionConfigurationsData | null;
  /** Appendix I plate, page 3. Provisional — see the file's `verification`
   * block before letting any of it reach a calculation. */
  fuelTankIndex: FuelTankIndexData | null;
}

function dataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "data");
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

/** Reads a file that a revision may legitimately not carry. Only a missing
 * file is tolerated — a present but malformed file still throws, so an
 * unreadable page can never silently degrade to "not published". */
function readOptionalJson(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  return readJson(filePath);
}

/**
 * Loads and validates every AHM 560 data file for a given
 * `aircraftType/edition/revision` (e.g. "a330-243p2f", 1, 0 ->
 * `data/a330-243p2f/ed1-rev0/`).
 *
 * Throws a zod validation error if any file is malformed — this loader is
 * the single point where "any AHM constant not baked into code" (rule #3)
 * meets "must be schema-validated before use".
 */
export function loadAhmData(aircraftType: string, edition: number, revision: number): AhmDataSet {
  const dir = path.join(dataRoot(), aircraftType, `ed${edition}-rev${revision}`);

  return {
    aircraft: AircraftDataSchema.parse(readJson(path.join(dir, "aircraft.json"))),
    indexFormula: IndexFormulaSchema.parse(readJson(path.join(dir, "index-formula.json"))),
    dowDoiMatrix: DowDoiMatrixSchema.parse(readJson(path.join(dir, "dow-doi-matrix.json"))),
    fuelIndex: FuelIndexSchema.parse(readJson(path.join(dir, "fuel-index.json"))),
    cgLimits: CgLimitsSchema.parse(readJson(path.join(dir, "cg-limits.json"))),
    compartments: CompartmentsSchema.parse(readJson(path.join(dir, "compartments.json"))),
    positions: PositionsSchema.parse(readJson(path.join(dir, "positions.json"))),
    combinedLoad: CombinedLoadSchema.parse(readJson(path.join(dir, "combined-load.json"))),
    zoneMapping: ZoneMappingSchema.parse(readJson(path.join(dir, "zone-mapping.json"))),
    uldTypes: UldTypesSchema.parse(readJson(path.join(dir, "uld-types.json"))),
    crewIndex: CrewIndexSchema.parse(readJson(path.join(dir, "crew-index.json"))),
    cargoIndexTable: parseOptional(dir, "cargo-index-table.json", CargoIndexTableSchema),
    lmcIndexTable: parseOptional(dir, "lmc-index-table.json", LmcIndexTableSchema),
    loadingZonesHArm: parseOptional(dir, "loading-zones-harm.json", LoadingZonesHArmSchema),
    lateralImbalance: parseOptional(dir, "lateral-imbalance.json", LateralImbalanceSchema),
    positionConfigurations: parseOptional(dir, "position-configurations.json", PositionConfigurationsSchema),
    fuelTankIndex: parseOptional(dir, "fuel-tank-index.json", FuelTankIndexSchema),
  };
}

function parseOptional<T extends z.ZodTypeAny>(dir: string, file: string, schema: T): z.infer<T> | null {
  const raw = readOptionalJson(path.join(dir, file));
  return raw === null ? null : schema.parse(raw);
}
