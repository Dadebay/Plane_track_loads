/**
 * @tua/wnb-core — error types.
 *
 * Every safety-relevant rejection (out-of-envelope CG, weight limit
 * exceeded, cumulative zone limit exceeded, fuel density out of range)
 * is a distinct, catchable class rather than a generic Error, so callers
 * (UI, PDF generation, message encoders) can branch on `instanceof`.
 */

export class WnbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Thrown when a ZFW/TOW/LDW index falls outside the AHM CG envelope for that phase. */
export class CgOutOfEnvelopeError extends WnbError {
  constructor(
    public readonly phase: "ZFW" | "TOW" | "LDW",
    public readonly weight: string,
    public readonly index: string,
    public readonly limit: { forward: string; aft: string },
  ) {
    super(
      `${phase} CG out of envelope: index ${index} at weight ${weight} kg is outside ` +
        `[${limit.forward}, ${limit.aft}]`,
    );
  }
}

/** Thrown when MZFW/MTOW/MLW/MTW or a per-position/compartment max gross is exceeded. */
export class WeightLimitExceededError extends WnbError {
  constructor(
    public readonly limitName: string,
    public readonly actual: string,
    public readonly max: string,
  ) {
    super(`${limitName} exceeded: ${actual} kg > max ${max} kg`);
  }
}

/** Thrown when a zone's cumulative combined load exceeds its AHM 560 §12 limit. */
export class CumulativeLoadExceededError extends WnbError {
  constructor(
    public readonly zone: string,
    public readonly actual: string,
    public readonly max: string,
  ) {
    super(`Combined load limit exceeded at zone ${zone}: cumulative ${actual} kg > max ${max} kg`);
  }
}

/** Thrown when fuel density falls outside the AHM 560 fuel index table range (0.760-0.830). */
export class FuelDensityOutOfRangeError extends WnbError {
  constructor(
    public readonly density: string,
    public readonly min: string,
    public readonly max: string,
  ) {
    super(`Fuel density ${density} is outside the table range [${min}, ${max}]`);
  }
}

/** Thrown when a fuel weight falls outside the extractable range of the density table (no extrapolation). */
export class FuelWeightOutOfRangeError extends WnbError {
  constructor(
    public readonly fuelWeight: string,
    public readonly density: string,
  ) {
    super(`Fuel weight ${fuelWeight} kg is outside the table range for density ${density} — extrapolation is forbidden`);
  }
}

/** Thrown when a load item references a position code that doesn't exist in the position data. */
export class PositionNotFoundError extends WnbError {
  constructor(public readonly code: string) {
    super(`Position "${code}" not found in position data`);
  }
}

/** Thrown when no DOW/DOI matrix cell matches the requested registration/crew combination. */
export class DowDoiNotFoundError extends WnbError {
  constructor(
    public readonly registration: string,
    public readonly cockpitCrew: number,
    public readonly courierCrew: number,
  ) {
    super(
      `No DOW/DOI cell for ${registration} with cockpit=${cockpitCrew}, courier=${courierCrew}`,
    );
  }
}

/** Thrown when ZFCG falls outside the combined-load table's documented band range (21-38% MAC). */
export class ZfcgOutOfRangeError extends WnbError {
  constructor(public readonly zfcg: string) {
    super(`ZFCG ${zfcg}% MAC is outside the combined-load table range [21, 38) — no band available`);
  }
}
