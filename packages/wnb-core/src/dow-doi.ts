import { d } from "./decimal-utils";
import { DowDoiNotFoundError } from "./errors";
import type { DowDoiCell } from "./types";

// AHM 560 s.6 §III — DOW & DOI dependence on crew versions.
// Exact-match lookup only: the matrix is a discrete table over
// cockpitCrew (1-4) x courierCrew (0-6), not an interpolable curve.
export function getDowDoi(
  registration: string,
  cockpitCrew: number,
  courierCrew: number,
  matrix: DowDoiCell[],
): { dow: string; doi: string } {
  const cell = matrix.find((c) => c.cockpitCrew === cockpitCrew && c.courierCrew === courierCrew);
  if (!cell) {
    throw new DowDoiNotFoundError(registration, cockpitCrew, courierCrew);
  }
  // Round-trip through Decimal to normalize formatting, never to alter the value.
  return { dow: d(cell.dow).toString(), doi: d(cell.doi).toString() };
}
