import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { buildPositionFootprints } from "@tua/wnb-core";
import { buildWorkspace, detailPanelPosition, nextCellIndex } from "../src/lib/position-workspace";
import type { DraftLoadItem, LoadPlanAhmData } from "../src/lib/load-plan-calc";

/**
 * Faz 2 (T5 477 parity brief, Aşama 6) — the loading workspace as data.
 *
 * Cell state is the part that has to be right: a position shown as free
 * when it is blocked is a loading error, not a cosmetic bug.
 */

const ahm = loadAhmData("a330-243p2f", 1, 2);

const ahmData = {
  positions: ahm.positions.positions,
  indexFormula: {
    refSta: ahm.indexFormula.refSta,
    k: ahm.indexFormula.k,
    c: ahm.indexFormula.c,
    refStaMinusLemac: ahm.indexFormula.derived.refStaMinusLemac,
    macOver100: ahm.indexFormula.derived.macOver100,
  },
  positionConfigurations: ahm.positionConfigurations!.configurations.map((c) => ({
    id: c.id,
    label: c.label,
    deck: c.deck,
    longitudinalInches: c.longitudinalInches,
    lateralInches: c.lateralInches,
    lateralPlacement: c.lateralPlacement,
  })),
  halfContainerPositions: ahm.positionConfigurations!.halfContainerPositions,
} as unknown as LoadPlanAhmData;

const footprints = buildPositionFootprints(
  ahmData.positions,
  ahmData.positionConfigurations!,
  ahmData.indexFormula,
  ahmData.halfContainerPositions,
);

function build(items: DraftLoadItem[], overloaded: string[] = [], readOnly = false) {
  return buildWorkspace(ahmData, items, footprints, new Set(overloaded), readOnly);
}

function cell(workspace: ReturnType<typeof build>, rowId: string, code: string) {
  const rows = [...workspace.main, ...workspace.lower];
  return rows.find((r) => r.id === rowId)!.cells.find((c) => c.code === code)!;
}

describe("buildWorkspace", () => {
  it("renders one row per printed configuration, split by deck", () => {
    const workspace = build([]);
    expect(workspace.main.map((r) => r.id)).toEqual([
      "SINGLE_ROW_88x125",
      "SINGLE_ROW_96x125",
      "SINGLE_ROW_125x96",
      "SIDE_BY_SIDE_125x88",
      "SIDE_BY_SIDE_125x96",
      "PALLET_16FT",
      "PALLET_20FT",
    ]);
    expect(workspace.lower.map((r) => r.id)).toEqual([
      "CONTAINER",
      "PALLET_88x125",
      "PALLET_96x125",
      "BULK",
    ]);
  });

  it("carries every published position exactly once per row", () => {
    const workspace = build([]);
    const cells = [...workspace.main, ...workspace.lower].flatMap((r) => r.cells);
    expect(cells).toHaveLength(ahmData.positions.length);
    expect(new Set(cells.map((c) => c.key)).size).toBe(cells.length);
  });

  it("starts every cell empty, with the published max gross", () => {
    const workspace = build([]);
    const a = cell(workspace, "SINGLE_ROW_88x125", "A");
    expect(a.state).toBe("EMPTY");
    expect(a.weight).toBeNull();
    expect(a.maxGross).toBe("2826");
  });

  it("marks a loaded position and carries its weight and ULD code", () => {
    const workspace = build([{ position: "A", weight: "2000", uldCode: "PMC12345TU" }]);
    const a = cell(workspace, "SINGLE_ROW_88x125", "A");
    expect(a.state).toBe("LOADED");
    expect(a.weight).toBe("2000");
    expect(a.uldCode).toBe("PMC12345TU");
  });

  it("marks an overloaded position, which outranks plain loaded", () => {
    const workspace = build([{ position: "A", weight: "9999" }], ["A"]);
    expect(cell(workspace, "SINGLE_ROW_88x125", "A").state).toBe("OVERLOADED");
  });

  it("blocks the empty positions a loaded one shares floor with", () => {
    const workspace = build([{ position: "AB", weight: "3000" }]);
    // AB is the 125" bridge across zones A and B.
    expect(cell(workspace, "SINGLE_ROW_88x125", "A").state).toBe("BLOCKED");
    expect(cell(workspace, "SINGLE_ROW_88x125", "B").state).toBe("BLOCKED");
    expect(cell(workspace, "SIDE_BY_SIDE_125x88", "ABL").state).toBe("BLOCKED");
    // ...and leaves the rest of the deck alone.
    expect(cell(workspace, "SINGLE_ROW_88x125", "F").state).toBe("EMPTY");
  });

  it("names which positions blocked a cell, so the UI can say why", () => {
    const workspace = build([{ position: "AB", weight: "3000" }]);
    expect(cell(workspace, "SINGLE_ROW_88x125", "A").blockedBy.map((b) => b.code)).toContain("AB");
    // The row matters: two configuration rows publish the same codes, so a
    // blocked cell has to say which row took it.
    expect(cell(workspace, "SINGLE_ROW_88x125", "A").blockedBy[0]?.rowLabel).toBeTruthy();
  });

  it("keeps a loaded cell loaded even when it is in a conflict", () => {
    // Both ends of a conflict are loaded: neither should read as merely
    // blocked, or the controller cannot see what to remove.
    const workspace = build([
      { position: "AB", weight: "3000" },
      { position: "A", weight: "1000" },
    ]);
    expect(cell(workspace, "SINGLE_ROW_125x96", "AB").state).toBe("LOADED");
    expect(cell(workspace, "SINGLE_ROW_88x125", "A").state).toBe("LOADED");
  });

  it("blocks a lower-deck container under a loaded pallet", () => {
    const workspace = build([{ position: "12P", weight: "2000", uldType: "PALLET_88x125" }]);
    expect(cell(workspace, "CONTAINER", "12").state).toBe("BLOCKED");
    expect(cell(workspace, "CONTAINER", "13").state).toBe("BLOCKED");
    expect(cell(workspace, "CONTAINER", "11").state).toBe("EMPTY");
    // The other pallet size at the same code is blocked too.
    expect(cell(workspace, "PALLET_96x125", "12P").state).toBe("BLOCKED");
  });

  it("marks only the loaded positions read-only on a finalized plan", () => {
    // This used to assert that *every* cell went READ_ONLY, which is what
    // made a finalized plate read as though the whole aircraft was loaded.
    // Read-only describes a loaded position that can no longer be edited;
    // it is not a mode the empty positions are in.
    const workspace = build([{ position: "A", weight: "2000" }], ["A"], true);
    const cells = [...workspace.main, ...workspace.lower].flatMap((c) => c.cells);
    const readOnly = cells.filter((c) => c.state === "READ_ONLY");

    expect(readOnly.map((c) => c.code)).toEqual(["A"]);
    expect(cells.some((c) => c.state === "EMPTY")).toBe(true);
  });

  it("returns empty decks when this AHM revision has no position plate", () => {
    const withoutPlate = { ...ahmData, positionConfigurations: null } as LoadPlanAhmData;
    const workspace = buildWorkspace(withoutPlate, [], [], new Set(), false);
    expect(workspace.main).toEqual([]);
    expect(workspace.lower).toEqual([]);
  });
});

describe("nextCellIndex", () => {
  it("walks the row and stops at both ends instead of wrapping", () => {
    expect(nextCellIndex(3, 10, "ArrowRight")).toBe(4);
    expect(nextCellIndex(3, 10, "ArrowLeft")).toBe(2);
    expect(nextCellIndex(9, 10, "ArrowRight")).toBe(9);
    expect(nextCellIndex(0, 10, "ArrowLeft")).toBe(0);
  });

  it("jumps to the ends", () => {
    expect(nextCellIndex(5, 10, "Home")).toBe(0);
    expect(nextCellIndex(5, 10, "End")).toBe(9);
  });

  it("ignores keys it does not handle, so typing still works", () => {
    expect(nextCellIndex(5, 10, "a")).toBeNull();
    expect(nextCellIndex(5, 10, "Enter")).toBeNull();
    expect(nextCellIndex(5, 10, "Tab")).toBeNull();
  });
});

describe("a finalized plan", () => {
  const loaded: DraftLoadItem[] = [{ position: "HH", weight: "2130", uldType: "SINGLE_ROW_96x125" }];

  it("keeps a loaded position readable but no longer editable", () => {
    const workspace = build(loaded, [], true);
    expect(cell(workspace, "SINGLE_ROW_96x125", "HH").state).toBe("READ_ONLY");
    expect(cell(workspace, "SINGLE_ROW_96x125", "HH").weight).toBe("2130");
  });

  it("leaves an untouched position empty rather than marking it loaded", () => {
    // Marking every cell READ_ONLY made a finalized plate read as though
    // every position on the aircraft carried a ULD.
    const workspace = build(loaded, [], true);
    const empty = cell(workspace, "SINGLE_ROW_96x125", "KK");
    expect(empty.state).toBe("EMPTY");
    expect(empty.weight).toBeNull();
  });

  it("still shows which positions the load blocks", () => {
    const workspace = build(loaded, [], true);
    expect(cell(workspace, "SINGLE_ROW_125x96", "HJ").state).toBe("BLOCKED");
  });
});

describe("detailPanelPosition", () => {
  const viewport = { width: 1440, height: 900 };
  const panel = { width: 260, maxHeight: 260, gap: 8 };

  it("sits to the right of a cell with room beside it", () => {
    const { left } = detailPanelPosition({ top: 400, left: 300, right: 380 }, viewport, panel);
    expect(left).toBe(388);
  });

  it("flips to the left rather than covering the last cell in a row", () => {
    // A cell hard against the right edge: clamping would put the panel on
    // top of it, which swallowed the click meant for that cell and sent the
    // weight to the same code on the other configuration row.
    const anchor = { top: 400, left: 1300, right: 1384 };
    const { left } = detailPanelPosition(anchor, viewport, panel);

    expect(left).toBe(1300 - 8 - 260);
    expect(left + panel.width).toBeLessThanOrEqual(anchor.left);
  });

  it("never leaves the viewport on either side", () => {
    const narrow = { width: 420, height: 900 };
    const { left } = detailPanelPosition({ top: 400, left: 40, right: 380 }, narrow, panel);
    expect(left).toBeGreaterThanOrEqual(panel.gap);
  });

  it("lifts a panel anchored near the bottom so it stays on screen", () => {
    const { top } = detailPanelPosition({ top: 880, left: 300, right: 380 }, viewport, panel);
    expect(top).toBe(900 - 260 - 8);
  });

  it("keeps a panel anchored above the top edge on screen", () => {
    const { top } = detailPanelPosition({ top: -40, left: 300, right: 380 }, viewport, panel);
    expect(top).toBe(8);
  });
});
