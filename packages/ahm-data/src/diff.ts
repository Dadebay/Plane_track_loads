/**
 * @tua/ahm-data — structural diff between two loaded AhmDataSet snapshots.
 *
 * Faz 5 (AHM master data admin UI): "iki revizyon arasındaki her değişikliği
 * göster". A positional/JSON-string diff would produce noise whenever a
 * table gained or lost a row (every later row would look "changed" even
 * though only its position shifted) — so array fields are matched by a
 * natural key (position code, zone name, fuel weight, cockpit/courier crew
 * combination, ...) wherever one is recognizable, and fall back to
 * positional comparison only for plain arrays of primitives.
 */

import type { AhmDataSet } from "./schema";

export type DiffEntryType = "added" | "removed" | "changed";

export interface DiffEntry {
  path: string;
  type: DiffEntryType;
  before?: unknown;
  after?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// Fields recognized as a natural identity key for an array element, tried
// in order. `cockpitCrew`+`courierCrew` (DOW/DOI matrix cells) is handled
// as a composite key before this list is consulted.
const NATURAL_KEY_FIELDS = ["code", "zone", "typeCode", "location", "position", "fuelWeight", "weight", "mac"];

function naturalKeyFor(item: unknown): string | null {
  if (!isPlainObject(item)) return null;
  if ("cockpitCrew" in item && "courierCrew" in item) {
    return `cockpit=${String(item.cockpitCrew)},courier=${String(item.courierCrew)}`;
  }
  for (const field of NATURAL_KEY_FIELDS) {
    const value = item[field];
    if (typeof value === "string" || typeof value === "number") {
      return `${field}=${String(value)}`;
    }
  }
  return null;
}

function diffArrays(path: string, before: unknown[], after: unknown[], out: DiffEntry[]): void {
  const beforeKeys = before.map(naturalKeyFor);
  const afterKeys = after.map(naturalKeyFor);
  const canUseNaturalKeys = beforeKeys.every((k) => k !== null) && afterKeys.every((k) => k !== null);

  if (!canUseNaturalKeys) {
    // Positional fallback for arrays of primitives (e.g. groundTruthRefs: string[]).
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i++) {
      diffValues(`${path}[${i}]`, before[i], after[i], out);
    }
    return;
  }

  const beforeMap = new Map(before.map((item, i) => [beforeKeys[i]!, item]));
  const afterMap = new Map(after.map((item, i) => [afterKeys[i]!, item]));

  for (const [key, beforeItem] of beforeMap) {
    if (!afterMap.has(key)) {
      out.push({ path: `${path}[${key}]`, type: "removed", before: beforeItem });
    } else {
      diffValues(`${path}[${key}]`, beforeItem, afterMap.get(key), out);
    }
  }
  for (const [key, afterItem] of afterMap) {
    if (!beforeMap.has(key)) {
      out.push({ path: `${path}[${key}]`, type: "added", after: afterItem });
    }
  }
}

const SIMPLE_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function objectKeyPath(path: string, key: string): string {
  if (!path) return key;
  return SIMPLE_IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function diffValues(path: string, before: unknown, after: unknown, out: DiffEntry[]): void {
  if (deepEqual(before, after)) return;

  if (before === undefined) {
    out.push({ path, type: "added", after });
    return;
  }
  if (after === undefined) {
    out.push({ path, type: "removed", before });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    diffArrays(path, before, after, out);
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffValues(objectKeyPath(path, key), before[key], after[key], out);
    }
    return;
  }

  out.push({ path, type: "changed", before, after });
}

/**
 * Diffs two loaded AHM data sets (typically two editions/revisions of the
 * same aircraft type, loaded via `loadAhmData`). Returns a flat list of
 * every leaf-level addition/removal/change, ordered by top-level data
 * file for readability in the admin diff UI.
 */
export function diffAhmData(before: AhmDataSet, after: AhmDataSet): DiffEntry[] {
  const out: DiffEntry[] = [];
  const sections: (keyof AhmDataSet)[] = [
    "aircraft",
    "indexFormula",
    "dowDoiMatrix",
    "fuelIndex",
    "cgLimits",
    "compartments",
    "positions",
    "combinedLoad",
    "zoneMapping",
    "uldTypes",
    "crewIndex",
  ];
  for (const section of sections) {
    diffValues(section, before[section], after[section], out);
  }
  return out;
}
