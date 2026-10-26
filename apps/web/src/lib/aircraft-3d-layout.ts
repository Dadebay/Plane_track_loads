import { Decimal } from "decimal.js";
import { buildPositionFootprints, positionKey } from "@tua/wnb-core";
import type { DraftLoadItem, LoadPlanAhmData } from "./load-plan-calc";
import { buildWorkspace, type WorkspaceCell } from "./position-workspace";

export type CargoDeck = "MAIN" | "LOWER";
export interface CargoPlacement {
  key: string;
  deck: CargoDeck;
  cell: WorkspaceCell;
  x: number;
  z: number;
  length: number;
  width: number;
  /** Bulk dimensions are illustrative: the AHM publishes no footprint. */
  approximate: boolean;
}

// Display geometry only; never an input to W&B or clearance calculations.
export const AIRFRAME_DISPLAY = { origin: 30, mainFloor: 5.05, lowerFloor: 3.1 };

/** AHM 560 s.15–16 / Appendix I s.74: reuse the exact same station and
 * footprint derivation as the existing workspace. Only the final display
 * coordinates become floats; weights and station arithmetic stay Decimal. */
export function buildCargoSceneData(
  ahm: LoadPlanAhmData,
  items: DraftLoadItem[],
  overloaded: Set<string>,
  readOnly: boolean,
) {
  const configurations = ahm.positionConfigurations ?? [];
  const footprints = buildPositionFootprints(
    ahm.positions,
    configurations,
    ahm.indexFormula,
    ahm.halfContainerPositions,
  );
  const byFootprint = new Map(footprints.map((f) => [f.key, f]));
  const byConfiguration = new Map(configurations.map((c) => [c.id, c]));
  const byPosition = new Map(ahm.positions.map((p) => [positionKey(p.uldType, p.code), p]));
  const workspace = buildWorkspace(ahm, items, footprints, overloaded, readOnly);
  const placements: CargoPlacement[] = [];
  for (const row of [...workspace.main, ...workspace.lower]) {
    for (const cell of row.cells) {
      const footprint = byFootprint.get(cell.key);
      const position = byPosition.get(cell.key);
      if (!position) continue;
      const config = byConfiguration.get(cell.uldType);
      const station = footprint
        ? new Decimal(footprint.from).plus(footprint.to).div(2)
        : new Decimal(ahm.indexFormula.refSta).plus(
            new Decimal(ahm.indexFormula.c).times(position.indexPerKg),
          );
      const length = footprint ? new Decimal(footprint.to).minus(footprint.from).toNumber() : 1.6;
      const side = footprint?.side ?? "CENTRE";
      const publishedWidth = config?.lateralInches
        ? new Decimal(config.lateralInches).times("0.0254").toNumber()
        : 2.5;
      const width = Math.min(publishedWidth, side === "CENTRE" ? 4.7 : 2.25);
      placements.push({
        key: cell.key,
        deck: row.deck,
        cell,
        x: station.minus(AIRFRAME_DISPLAY.origin).toNumber(),
        z: side === "LEFT" ? 1.2 : side === "RIGHT" ? -1.2 : 0,
        length,
        width,
        approximate: !footprint,
      });
    }
  }
  const loaded = placements.filter((p) => p.cell.weight !== null);
  const mapped = new Set(loaded.map((p) => p.cell.code));
  // Do not silently omit unresolved legacy variants from the weight display.
  const unmapped = items.filter((item) => !mapped.has(item.position));
  const sum = (loads: DraftLoadItem[]) =>
    loads.reduce((total, item) => total.plus(item.weight || "0"), new Decimal(0)).toString();
  return {
    workspace,
    placements,
    loaded,
    unmapped,
    totalWeight: sum(items),
    mainWeight: sum(
      items.filter((item) =>
        ahm.positions.some((p) => p.code === item.position && p.deck === "MAIN"),
      ),
    ),
    lowerWeight: sum(
      items.filter((item) =>
        ahm.positions.some((p) => p.code === item.position && p.deck === "LOWER"),
      ),
    ),
  };
}
export type CargoSceneData = ReturnType<typeof buildCargoSceneData>;
