import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { buildPositionFootprints } from "@tua/wnb-core";
import { buildCargoSceneData, AIRFRAME_DISPLAY } from "../src/lib/aircraft-3d-layout";
import type { DraftLoadItem, LoadPlanAhmData } from "../src/lib/load-plan-calc";

const ahm = loadAhmData("a330-243p2f", 1, 2);
const data = {
  positions: ahm.positions.positions,
  indexFormula: ahm.indexFormula,
  positionConfigurations: ahm.positionConfigurations!.configurations,
  halfContainerPositions: ahm.positionConfigurations!.halfContainerPositions,
} as unknown as LoadPlanAhmData;
const build = (items: DraftLoadItem[], readOnly = false) =>
  buildCargoSceneData(data, items, new Set(["A"]), readOnly);

describe("3D cargo uses the existing loading contract", () => {
  it("places a load at the same published footprint used by conflict checks", () => {
    const result = build([{ position: "A", weight: "2000.5" }]);
    const cargo = result.loaded[0]!;
    const footprint = buildPositionFootprints(
      data.positions,
      data.positionConfigurations!,
      data.indexFormula,
    ).find((f) => f.key === cargo.key)!;
    expect(cargo.x + AIRFRAME_DISPLAY.origin).toBeCloseTo(
      (Number(footprint.from) + Number(footprint.to)) / 2,
      8,
    );
    expect(cargo.length).toBeCloseTo(Number(footprint.to) - Number(footprint.from), 8);
    expect(cargo.cell.weight).toBe("2000.5");
    expect(cargo.cell.state).toBe("OVERLOADED");
    expect(cargo.approximate).toBe(false);
  });

  it("disambiguates side-by-side variants and keeps their two lateral positions separate", () => {
    const result = build([
      { position: "ABL", uldType: "SIDE_BY_SIDE_125x88", weight: "2000" },
      { position: "ABR", uldType: "SIDE_BY_SIDE_125x88", weight: "2100" },
    ]);
    expect(result.loaded).toHaveLength(2);
    expect(result.loaded.every((p) => p.cell.uldType === "SIDE_BY_SIDE_125x88")).toBe(true);
    expect(result.loaded.find((p) => p.cell.code === "ABL")!.z).toBeGreaterThan(0);
    expect(result.loaded.find((p) => p.cell.code === "ABR")!.z).toBeLessThan(0);
    expect(result.loaded[0]!.x).toBe(result.loaded[1]!.x);
    expect(result.placements.find((p) => p.cell.code === "A")!.cell.state).toBe("BLOCKED");
  });

  it("keeps exact gross totals when loading, editing and removing cargo on different decks", () => {
    const items = [
      { position: "A", weight: "0.1" },
      { position: "11", uldType: "CONTAINER", weight: "0.2" },
    ];
    expect(build(items).totalWeight).toBe("0.3");
    expect(build(items).mainWeight).toBe("0.1");
    expect(build(items).lowerWeight).toBe("0.2");
    const edited = build([{ ...items[0]!, weight: "1234.56" }, items[1]!]);
    expect(edited.loaded).toHaveLength(2);
    expect(edited.totalWeight).toBe("1234.76");
    expect(build([items[1]!]).loaded.map((p) => p.cell.code)).toEqual(["11"]);
    expect(build([]).loaded).toEqual([]);
  });

  it("does not create competing units for ambiguous legacy variants and retains their weight", () => {
    const result = build([{ position: "ABR", weight: "1700" }]);
    expect(result.loaded).toHaveLength(0);
    expect(result.unmapped.map((i) => i.position)).toEqual(["ABR"]);
    expect(result.totalWeight).toBe("1700");
  });

  it("marks bulk shapes as illustrative and keeps finalized cells read-only", () => {
    const result = build(
      [
        { position: "51", uldType: "BULK", weight: "321.7" },
        { position: "A", weight: "2500" },
      ],
      true,
    );
    expect(result.loaded.find((p) => p.cell.code === "51")?.approximate).toBe(true);
    expect(result.loaded.every((p) => p.cell.state === "READ_ONLY")).toBe(true);
    expect(result.totalWeight).toBe("2821.7");
  });
});
