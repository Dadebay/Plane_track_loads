/**
 * Flattening for the AHM master-data screen.
 *
 * These maps hold rows *and* metadata side by side: `dow-doi-matrix.json`
 * carries a `crewWeights` object and a `notes` array of sentences next to
 * the per-registration row arrays, and a revision may add more. The screen
 * used to exclude metadata by key name, so the first key nobody had listed
 * (`crewWeights`) reached `.map()` and took the page down with a
 * client-side exception.
 *
 * Selecting by the *row's own shape* cannot rot that way: being an array is
 * not enough — `notes` is an array too — so each entry has to look like a
 * row before it is treated as one.
 */

export interface DowDoiRow {
  registration: string;
  cockpitCrew: number;
  courierCrew: number;
  dow: string;
  doi: string;
}

type Cell = Omit<DowDoiRow, "registration">;

function isDowDoiCell(value: unknown): value is Cell {
  return typeof value === "object" && value !== null && "dow" in value && "doi" in value;
}

export function toDowDoiRows(matrix: Record<string, unknown>): DowDoiRow[] {
  return Object.entries(matrix).flatMap(([registration, cells]) =>
    Array.isArray(cells)
      ? cells.filter(isDowDoiCell).map((cell) => ({ registration, ...cell }))
      : [],
  );
}

export interface FuelIndexRow {
  density: string;
  fuelWeight: string;
  index: string;
}

function isFuelIndexCell(value: unknown): value is Omit<FuelIndexRow, "density"> {
  return typeof value === "object" && value !== null && "fuelWeight" in value && "index" in value;
}

export function toFuelIndexRows(fuelIndex: Record<string, unknown>): FuelIndexRow[] {
  return Object.entries(fuelIndex).flatMap(([density, rows]) =>
    Array.isArray(rows)
      ? rows.filter(isFuelIndexCell).map((row) => ({ density, ...row }))
      : [],
  );
}
