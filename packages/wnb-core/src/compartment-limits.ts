import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type { Compartment, LimitCheck, LoadItem, Position } from "./types";

// AHM 560 s.54 §9 (compartment table) / s.77 (LIR header sub-limits):
// lower-deck bay codes are grouped by their leading digit into compartment
// number — "1x"/"1xP" -> comp 1, "2x"/"2xP" -> comp 2, ... "5x" -> comp 5
// (bulk). This grouping isn't printed as an explicit lookup table in AHM
// 560; it's inferred from the bay numbering scheme and cross-checked
// against GROUND_TRUTH.md §19.1's worked fwd/aft/bulk compartment sums,
// which this exact grouping reproduces exactly (3824 / 3845 / 680 kg).
function compartmentNumberForPosition(code: string): number | null {
  const m = /^([1-5])/.exec(code);
  return m ? Number(m[1]) : null;
}

/**
 * AHM 560 s.4 (main deck max load), s.54 §9 (compartment pair limits),
 * s.77 (LIR per-bay sub-limits) — reports per-compartment and main-deck
 * gross weight against their published maxima.
 *
 * Returns one LimitCheck per compartment's individual (LIR) sub-limit,
 * one per fwd/aft compartment PAIR combined limit, and one for the main
 * deck total. Never throws for a business-rule violation — see
 * checkEnvelope's doc comment for the rationale (live UI feedback).
 */
export function checkCompartmentLimits(
  loadItems: LoadItem[],
  positions: Position[],
  compartments: Compartment[],
  mainDeckMaxLoad: string,
): LimitCheck[] {
  const positionByCode = new Map(positions.map((p) => [p.code, p]));
  const checks: LimitCheck[] = [];

  const byCompartment = new Map<number, Decimal>();
  let mainDeckTotal = new Decimal(0);

  for (const item of loadItems) {
    const pos = positionByCode.get(item.position);
    if (!pos) continue; // unknown positions are a data problem the caller should validate separately
    const weight = d(item.weight);

    if (pos.deck === "MAIN") {
      mainDeckTotal = mainDeckTotal.plus(weight);
      continue;
    }

    const compNum = compartmentNumberForPosition(item.position);
    if (compNum === null) continue;
    byCompartment.set(compNum, (byCompartment.get(compNum) ?? new Decimal(0)).plus(weight));
  }

  for (const comp of compartments) {
    const actual = byCompartment.get(comp.number) ?? new Decimal(0);
    checks.push({
      target: `compartment ${comp.number} (${comp.description})`,
      actual: actual.toString(),
      max: comp.lirSubLimit,
      withinLimit: actual.lte(d(comp.lirSubLimit)),
    });
  }

  const pairs = new Map<string, { compartments: number[]; max: string }>();
  for (const comp of compartments) {
    if (comp.pairedWith === null) continue;
    const key = [comp.number, comp.pairedWith].sort((a, b) => a - b).join("+");
    if (!pairs.has(key)) {
      pairs.set(key, { compartments: [comp.number, comp.pairedWith], max: comp.maxGrossPair });
    }
  }
  for (const [key, pair] of pairs) {
    const total = pair.compartments.reduce(
      (acc, n) => acc.plus(byCompartment.get(n) ?? new Decimal(0)),
      new Decimal(0),
    );
    checks.push({
      target: `compartments ${key} combined`,
      actual: total.toString(),
      max: pair.max,
      withinLimit: total.lte(d(pair.max)),
    });
  }

  checks.push({
    target: "main deck",
    actual: mainDeckTotal.toString(),
    max: mainDeckMaxLoad,
    withinLimit: mainDeckTotal.lte(d(mainDeckMaxLoad)),
  });

  return checks;
}
