import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import { calculateWnb } from "./wnb";
import type { LmcChange, LoadItem, WnbInput, WnbResult } from "./types";

export interface LmcResult {
  before: WnbResult;
  after: WnbResult;
  lmcTotal: string;
  changes: LmcChange[];
}

/**
 * AHM 560-driven Last Minute Change: applies a set of weight deltas to an
 * existing load and recomputes the full W&B result.
 *
 * Deviates slightly from the `applyLmc(result, changes)` signature sketched
 * in IMPLEMENTATION_PLAN Faz 3: a `WnbResult` alone is an aggregate (ZFW,
 * indices, ...) and doesn't carry the per-position load list needed to
 * safely recompute after an LMC. This takes the original `WnbInput`
 * instead, so the recomputation is a real `calculateWnb` run over the
 * adjusted load — not an ad-hoc patch of already-rounded output numbers,
 * which would compound rounding error (CLAUDE.md rule #2).
 *
 * A change whose `position` has no existing load item is treated as a new
 * item added at that position; a change against an existing item adjusts
 * its weight by `weightDelta` (negative = load removed). This mirrors a
 * real LMC block ("LAST MINUTE CHANGES") on the loadsheet — see
 * IMPLEMENTATION_PLAN Faz 12.
 */
export function applyLmc(input: WnbInput, changes: LmcChange[]): LmcResult {
  const before = calculateWnb(input);

  const items = new Map<string, LoadItem>(input.loadItems.map((item) => [item.position, item]));
  for (const change of changes) {
    const existing = items.get(change.position);
    if (existing) {
      const newWeight = d(existing.weight).plus(d(change.weightDelta));
      items.set(change.position, { ...existing, weight: newWeight.toString() });
    } else {
      items.set(change.position, {
        position: change.position,
        weight: change.weightDelta,
        contentCode: undefined,
      });
    }
  }

  const after = calculateWnb({ ...input, loadItems: Array.from(items.values()) });

  const lmcTotal = changes
    .reduce((acc, c) => acc.plus(d(c.weightDelta)), new Decimal(0))
    .toDecimalPlaces(1)
    .toString();

  return { before, after, lmcTotal, changes };
}
