import type { Position } from "@tua/wnb-core";

export interface PositionGroup {
  code: string;
  deck: "MAIN" | "LOWER";
  variants: Position[];
}

/** Groups the (possibly duplicate-keyed, see resolvePositions) AHM
 * positions array by code — one entry per physical position, carrying
 * every uldType variant it can take. */
export function groupByCode(positions: Position[]): PositionGroup[] {
  const byCode = new Map<string, PositionGroup>();
  for (const pos of positions) {
    const existing = byCode.get(pos.code);
    if (existing) existing.variants.push(pos);
    else byCode.set(pos.code, { code: pos.code, deck: pos.deck, variants: [pos] });
  }
  return [...byCode.values()];
}
