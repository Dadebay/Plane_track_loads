import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { optimizeTrim, type TrimOptimizationInput } from "../src/trim-optimizer";
import { calculateWnb } from "../src/wnb";
import { checkEnvelope } from "../src/envelope";
import { t5692Input } from "./fixtures/t5692";
import type { LoadItem } from "../src/types";

const ahm = loadAhmData("a330-243p2f", 1, 0);

const trimInput: TrimOptimizationInput = {
  items: t5692Input.loadItems,
  positions: t5692Input.positions,
  dow: t5692Input.dow,
  doi: t5692Input.doi,
  weightLimits: t5692Input.weightLimits,
  fuel: t5692Input.fuel,
  fuelIndexTable: t5692Input.fuelIndexTable,
  indexFormula: t5692Input.indexFormula,
  cgLimits: ahm.cgLimits,
  stabCurve: t5692Input.stabCurve,
  stabRounding: t5692Input.stabRounding,
};

describe("optimizeTrim", () => {
  it("never invents, drops, or reweighs an item — only reassigns positions", () => {
    const result = optimizeTrim(trimInput);
    const originalWeights = trimInput.items.map((i) => i.weight).sort();
    const resultWeights = result.items.map((i) => i.weight).sort();
    expect(resultWeights).toEqual(originalWeights);
    expect(result.items).toHaveLength(trimInput.items.length);
  });

  it("assigns every item to a distinct position", () => {
    const result = optimizeTrim(trimInput);
    const positions = result.items.map((i) => i.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("never assigns an item to a position whose maxGross it exceeds", () => {
    const result = optimizeTrim(trimInput);
    const positionByCode = new Map(trimInput.positions.map((p) => [p.code, p]));
    for (const item of result.items) {
      const pos = positionByCode.get(item.position);
      expect(pos).toBeDefined();
      expect(Number(item.weight)).toBeLessThanOrEqual(Number(pos!.maxGross));
    }
  });

  it("produces a distribution within the ZFW CG envelope for the real T5 692 load", () => {
    const result = optimizeTrim(trimInput);
    expect(result.success).toBe(true);

    const wnbResult = calculateWnb({ ...t5692Input, loadItems: result.items });
    const envelope = checkEnvelope(wnbResult.zfw, wnbResult.lizfw, "ZFW", ahm.cgLimits.zfw);
    expect(envelope.withinEnvelope).toBe(true);
  });

  it("recovers an in-envelope distribution from a deliberately front-loaded (out-of-envelope) starting assignment", () => {
    // Force every item onto the most-forward positions (in position-code
    // order, wrapping — ordinarily nonsensical, but it deliberately biases
    // the deadload index hard toward one side) to exercise recovery from a
    // bad starting point using the same real item weights.
    const forward = [...t5692Input.positions].sort((a, b) => Number(a.indexPerKg) - Number(b.indexPerKg));
    const seen = new Set<string>();
    let cursor = 0;
    const badItems: LoadItem[] = trimInput.items.map((item) => {
      while (seen.has(forward[cursor % forward.length]!.code)) cursor++;
      const code = forward[cursor % forward.length]!.code;
      seen.add(code);
      cursor++;
      return { ...item, position: code };
    });

    const badResult = calculateWnb({ ...t5692Input, loadItems: badItems });
    const badEnvelope = checkEnvelope(badResult.zfw, badResult.lizfw, "ZFW", ahm.cgLimits.zfw);
    expect(badEnvelope.withinEnvelope).toBe(false);

    const optimized = optimizeTrim({ ...trimInput, items: badItems });
    expect(optimized.success).toBe(true);
  });

  it("reports iterations used", () => {
    const result = optimizeTrim(trimInput);
    expect(result.iterations).toBeGreaterThanOrEqual(0);
  });

  it("reports failure (not a throw) when the load itself exceeds a weight limit", () => {
    const tooHeavy: LoadItem[] = [{ position: "TT", weight: "999999" }];
    const result = optimizeTrim({ ...trimInput, items: tooHeavy });
    expect(result.success).toBe(false);
  });
});
