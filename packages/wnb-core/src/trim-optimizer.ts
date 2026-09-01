import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import { calculateWnb } from "./wnb";
import { checkEnvelope, interpolateCurve } from "./envelope";
import type {
  CgLimits,
  FuelIndexTable,
  FuelState,
  IndexFormula,
  LoadItem,
  Position,
  StabRoundingRule,
  StabTrimPoint,
  WeightLimits,
} from "./types";

/**
 * Faz 8 görev 6 — automatic trim optimization (no AHM 560 counterpart;
 * this is new functionality, not an extraction of published data).
 * Reassigns the given load items across the given positions to bring
 * ZFW's %MAC as close as possible to the center of the AHM CG envelope,
 * without changing any item's weight, AWB, ULD code, or content code —
 * only which position it sits in.
 *
 * Total ZFW is invariant under reassignment (same items, same weights),
 * so the envelope's forward/aft limit at that weight — and therefore its
 * center — can be computed once up front and used as a fixed target.
 *
 * Algorithm: a neutral-balance greedy pass (heaviest items go to the
 * positions with index-per-kg closest to zero, i.e. closest to the
 * aircraft's reference station) for a reasonable starting point, then
 * bounded pairwise-swap local search toward the target index. This finds
 * *a* valid in-envelope distribution when one exists among the given
 * items/positions — not necessarily the global optimum (an exact
 * solution is a constrained bin-packing problem, NP-hard in general).
 */
export interface TrimOptimizationInput {
  items: LoadItem[];
  positions: Position[];
  dow: string;
  doi: string;
  weightLimits: WeightLimits;
  fuel: FuelState;
  fuelIndexTable: FuelIndexTable;
  indexFormula: IndexFormula;
  cgLimits: CgLimits;
  stabCurve: StabTrimPoint[];
  stabRounding: StabRoundingRule;
}

export interface TrimOptimizationResult {
  items: LoadItem[];
  success: boolean;
  iterations: number;
}

const MAX_ITERATIONS = 200;
const CONVERGED_THRESHOLD = "0.01";

function neutralBalanceAssign(items: LoadItem[], positions: Position[]): LoadItem[] {
  const sortedItems = [...items].sort((a, b) => d(b.weight).minus(d(a.weight)).toNumber());
  const byNeutrality = [...positions].sort((a, b) =>
    d(a.indexPerKg).abs().minus(d(b.indexPerKg).abs()).toNumber(),
  );
  const used = new Set<string>();
  return sortedItems.map((item) => {
    const pos = byNeutrality.find((p) => !used.has(p.code) && d(item.weight).lte(d(p.maxGross)));
    if (!pos) return item; // doesn't fit anywhere — best effort, leave as-is
    used.add(pos.code);
    return { ...item, position: pos.code };
  });
}

export function optimizeTrim(input: TrimOptimizationInput): TrimOptimizationResult {
  const positionByCode = new Map(input.positions.map((p) => [p.code, p]));
  const dow = d(input.dow);
  const doi = d(input.doi);
  const zfw = dow.plus(input.items.reduce((sum, item) => sum.plus(d(item.weight)), new Decimal(0)));

  let targetIndex: Decimal;
  try {
    const forwardLimit = interpolateCurve(zfw, input.cgLimits.zfw.forward, "ZFW forward");
    const aftLimit = interpolateCurve(zfw, input.cgLimits.zfw.aft, "ZFW aft");
    targetIndex = forwardLimit.plus(aftLimit).dividedBy(2);
  } catch {
    // ZFW itself is outside the published CG table range — no
    // reassignment can fix a weight problem.
    return { items: input.items, success: false, iterations: 0 };
  }

  function totalIndex(list: LoadItem[]): Decimal {
    let total = doi;
    for (const item of list) {
      const pos = positionByCode.get(item.position);
      if (!pos) continue;
      total = total.plus(d(item.weight).times(d(pos.indexPerKg)));
    }
    return total;
  }

  let items = neutralBalanceAssign(input.items, input.positions);
  let iterations = 0;

  for (; iterations < MAX_ITERATIONS; iterations++) {
    const current = totalIndex(items);
    if (current.minus(targetIndex).abs().lte(CONVERGED_THRESHOLD)) break;

    let bestSwap: [number, number] | null = null;
    let bestDistance = current.minus(targetIndex).abs();

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i]!;
        const itemB = items[j]!;
        const posA = positionByCode.get(itemA.position);
        const posB = positionByCode.get(itemB.position);
        if (!posA || !posB) continue;
        if (d(itemA.weight).gt(d(posB.maxGross)) || d(itemB.weight).gt(d(posA.maxGross))) continue;

        const delta = d(itemB.weight).minus(d(itemA.weight)).times(d(posA.indexPerKg).minus(d(posB.indexPerKg)));
        const swappedDistance = current.plus(delta).minus(targetIndex).abs();
        if (swappedDistance.lt(bestDistance)) {
          bestDistance = swappedDistance;
          bestSwap = [i, j];
        }
      }
    }

    if (!bestSwap) break;
    const [i, j] = bestSwap;
    const next = [...items];
    const positionI = next[i]!.position;
    next[i] = { ...next[i]!, position: next[j]!.position };
    next[j] = { ...next[j]!, position: positionI };
    items = next;
  }

  try {
    const wnbResult = calculateWnb({
      weightLimits: input.weightLimits,
      dow: input.dow,
      doi: input.doi,
      loadItems: items,
      positions: input.positions,
      fuel: input.fuel,
      fuelIndexTable: input.fuelIndexTable,
      indexFormula: input.indexFormula,
      stabCurve: input.stabCurve,
      stabRounding: input.stabRounding,
    });
    const envelopeCheck = checkEnvelope(wnbResult.zfw, wnbResult.lizfw, "ZFW", input.cgLimits.zfw);
    return { items, success: envelopeCheck.withinEnvelope, iterations };
  } catch {
    // Weight-limit exceeded is a weight problem, not a trim problem —
    // reassignment can't fix it either way.
    return { items, success: false, iterations };
  }
}
