import { describe, expect, it } from "vitest";
import type { Position } from "@tua/wnb-core";
import { groupByCode, pickVariant } from "../src/app/[locale]/(app)/flights/[id]/load-plan/position-groups";

const position = (code: string, uldType: string): Position => ({
  code,
  deck: "MAIN",
  uldType,
  maxGross: "2000",
  indexPerKg: "-0.0140",
});

// MPR is published on both side-by-side rows — the case that sent a load
// to the wrong configuration row.
const variants = [position("MPR", "SIDE_BY_SIDE_125x88"), position("MPR", "SIDE_BY_SIDE_125x96")];

describe("pickVariant", () => {
  it("starts on the row the controller clicked", () => {
    expect(pickVariant(variants, "SIDE_BY_SIDE_125x96", undefined)).toBe("SIDE_BY_SIDE_125x96");
    expect(pickVariant(variants, "SIDE_BY_SIDE_125x88", undefined)).toBe("SIDE_BY_SIDE_125x88");
  });

  it("keeps the variant a loaded position was loaded on", () => {
    expect(pickVariant(variants, null, "SIDE_BY_SIDE_125x96")).toBe("SIDE_BY_SIDE_125x96");
  });

  it("prefers the clicked row over the stored one, so a move is possible", () => {
    expect(pickVariant(variants, "SIDE_BY_SIDE_125x88", "SIDE_BY_SIDE_125x96")).toBe("SIDE_BY_SIDE_125x88");
  });

  it("falls back to the first published variant when nothing is known", () => {
    expect(pickVariant(variants, null, undefined)).toBe("SIDE_BY_SIDE_125x88");
  });

  it("ignores a variant this position does not publish", () => {
    expect(pickVariant(variants, "PALLET_20FT", undefined)).toBe("SIDE_BY_SIDE_125x88");
  });

  it("copes with a position that has no variants at all", () => {
    expect(pickVariant([], "SIDE_BY_SIDE_125x96", undefined)).toBe("");
  });
});

describe("groupByCode", () => {
  it("keeps every variant of a duplicated code", () => {
    const groups = groupByCode(variants);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.variants.map((v) => v.uldType)).toEqual([
      "SIDE_BY_SIDE_125x88",
      "SIDE_BY_SIDE_125x96",
    ]);
  });
});
