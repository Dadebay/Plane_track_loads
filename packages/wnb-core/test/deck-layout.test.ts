import { describe, expect, it } from "vitest";
import { buildDeckLayout } from "../src/deck-layout";
import type { Position, PositionConfiguration } from "../src/types";

const configurations: PositionConfiguration[] = [
  {
    id: "SINGLE_ROW_96x125",
    label: 'SINGLE ROW 96"x125"',
    deck: "MAIN",
    longitudinalInches: "125",
    lateralInches: "96",
    lateralPlacement: "CENTRE",
  },
  {
    id: "SIDE_BY_SIDE_125x96",
    label: 'SIDE BY SIDE 125"x96"',
    deck: "MAIN",
    longitudinalInches: "96",
    lateralInches: "125",
    lateralPlacement: "PAIRED_LEFT_RIGHT",
  },
  {
    id: "PALLET_96x125_LOWER",
    label: 'PALLET 96"x125"',
    deck: "LOWER",
    longitudinalInches: "125",
    lateralInches: "96",
    lateralPlacement: "CENTRE",
  },
  {
    id: "PALLET_20FT",
    label: '20FT PALLET 238.5"x96"',
    deck: "MAIN",
    longitudinalInches: "238.5",
    lateralInches: "96",
    lateralPlacement: "CENTRE",
  },
];

const positions: Position[] = [
  { code: "AA", deck: "MAIN", uldType: "SINGLE_ROW_96x125", maxGross: "2826", indexPerKg: "-0.0121" },
  { code: "BB", deck: "MAIN", uldType: "SINGLE_ROW_96x125", maxGross: "2826", indexPerKg: "-0.0105" },
  { code: "ABL", deck: "MAIN", uldType: "SIDE_BY_SIDE_125x96", maxGross: "2000", indexPerKg: "-0.0140" },
  { code: "ABR", deck: "MAIN", uldType: "SIDE_BY_SIDE_125x96", maxGross: "2000", indexPerKg: "-0.0140" },
  { code: "12P", deck: "LOWER", uldType: "PALLET_96x125_LOWER", maxGross: "3174", indexPerKg: "-0.0080" },
];

describe("buildDeckLayout", () => {
  it("groups positions into plate rows, split by deck", () => {
    const layout = buildDeckLayout(positions, configurations);

    expect(layout.main.map((r) => r.id)).toEqual(["SINGLE_ROW_96x125", "SIDE_BY_SIDE_125x96"]);
    expect(layout.lower.map((r) => r.id)).toEqual(["PALLET_96x125_LOWER"]);
    expect(layout.main[0]!.label).toBe('SINGLE ROW 96"x125"');
  });

  it("keeps the plate's own row and cell order", () => {
    const layout = buildDeckLayout(positions, configurations);
    expect(layout.main[0]!.cells.map((c) => c.code)).toEqual(["AA", "BB"]);
    expect(layout.main[1]!.cells.map((c) => c.code)).toEqual(["ABL", "ABR"]);
  });

  it("carries the per-position max gross and a unique key", () => {
    const layout = buildDeckLayout(positions, configurations);
    expect(layout.main[1]!.cells[0]).toEqual({
      key: "SIDE_BY_SIDE_125x96/ABL",
      code: "ABL",
      uldType: "SIDE_BY_SIDE_125x96",
      maxGross: "2000",
    });
    const keys = [...layout.main, ...layout.lower].flatMap((r) => r.cells.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("drops a configuration with no published position on this airframe", () => {
    const layout = buildDeckLayout(positions, configurations);
    expect([...layout.main, ...layout.lower].map((r) => r.id)).not.toContain("PALLET_20FT");
  });

  it("returns an empty layout when the plate page is not held", () => {
    expect(buildDeckLayout(positions, null)).toEqual({ main: [], lower: [] });
  });

  it("prints every published position exactly once", () => {
    const layout = buildDeckLayout(positions, configurations);
    const codes = [...layout.main, ...layout.lower].flatMap((r) => r.cells.map((c) => c.code));
    expect(codes.sort()).toEqual(["12P", "AA", "ABL", "ABR", "BB"]);
  });
});
