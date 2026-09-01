import type { Decimal } from "decimal.js";
import { d, lerp } from "./decimal-utils";
import { FuelDensityOutOfRangeError, FuelWeightOutOfRangeError } from "./errors";
import type { FuelIndexRow, FuelIndexTable } from "./types";

interface NumericRow {
  weight: Decimal;
  index: Decimal;
}

function numericRows(rows: FuelIndexRow[]): NumericRow[] {
  // The "FULL" row is a non-numeric sentinel (tank-full state) and is
  // excluded from weight-based interpolation — see GROUND_TRUTH.md §8.
  return rows
    .filter((r) => r.fuelWeight !== "FULL")
    .map((r) => ({ weight: d(r.fuelWeight), index: d(r.index) }))
    .sort((a, b) => a.weight.comparedTo(b.weight));
}

function interpolateWithinTable(fuelWeight: Decimal, rows: NumericRow[], density: string): Decimal {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) {
    throw new Error(`fuel index table for density ${density} has no numeric rows`);
  }
  if (fuelWeight.lt(first.weight) || fuelWeight.gt(last.weight)) {
    throw new FuelWeightOutOfRangeError(fuelWeight.toString(), density);
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    if (fuelWeight.gte(a.weight) && fuelWeight.lte(b.weight)) {
      if (fuelWeight.eq(a.weight)) return a.index;
      if (fuelWeight.eq(b.weight)) return b.index;
      return lerp(fuelWeight, a.weight, a.index, b.weight, b.index);
    }
  }

  // Unreachable given the range check above.
  throw new Error(`could not bracket fuel weight ${fuelWeight.toString()} in density ${density} table`);
}

/**
 * AHM 560 s.17-46 §8 — fuel index lookup with linear interpolation.
 *
 * Extrapolation beyond a density table's weight range is forbidden (throws
 * FuelWeightOutOfRangeError) and a density outside [0.760, 0.830] is
 * rejected outright (FuelDensityOutOfRangeError) — GROUND_TRUTH.md §8.
 *
 * If `density` doesn't exactly match one of the table's density keys, this
 * falls back to a second interpolation pass between the two nearest
 * density tables. GROUND_TRUTH.md §8 flags this as an OPEN QUESTION not
 * resolved by the T5 692 test vector (which uses density 0.785, an exact
 * table match) — see GROUND_TRUTH.md §21 Q1. TODO: confirm with operations
 * whether double interpolation or nearest-table rounding is correct before
 * this path is used operationally.
 */
export function getFuelIndex(fuelWeight: string, density: string, table: FuelIndexTable): Decimal {
  const weight = d(fuelWeight);
  const densities = Object.keys(table)
    .map((k) => ({ key: k, value: d(k) }))
    .sort((a, b) => a.value.comparedTo(b.value));

  const min = densities[0];
  const max = densities[densities.length - 1];
  if (!min || !max) {
    throw new Error("fuel index table is empty");
  }

  const requested = d(density);
  if (requested.lt(min.value) || requested.gt(max.value)) {
    throw new FuelDensityOutOfRangeError(density, min.key, max.key);
  }

  const exact = table[density];
  if (exact) {
    return interpolateWithinTable(weight, numericRows(exact), density);
  }

  // TODO(GROUND_TRUTH.md §21 Q1): density falls between two published
  // tables. Interpolating between the two nearest tables' results is one
  // reasonable reading of AHM 560, but is NOT confirmed against a real
  // loadsheet — ask operations before relying on this in production.
  let lower = densities[0]!;
  let upper = densities[densities.length - 1]!;
  for (let i = 0; i < densities.length - 1; i++) {
    const a = densities[i]!;
    const b = densities[i + 1]!;
    if (requested.gte(a.value) && requested.lte(b.value)) {
      lower = a;
      upper = b;
      break;
    }
  }

  const lowerIndex = interpolateWithinTable(weight, numericRows(table[lower.key]!), lower.key);
  const upperIndex = interpolateWithinTable(weight, numericRows(table[upper.key]!), upper.key);
  return lerp(requested, lower.value, lowerIndex, upper.value, upperIndex);
}
