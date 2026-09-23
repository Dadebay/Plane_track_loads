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

/**
 * Which ULD-size variant an assignment starts on.
 *
 * A code like `MPR` exists on more than one mutually exclusive
 * configuration row (125"x88" and 125"x96"), so the plate shows it twice.
 * Picking the first published variant regardless of which cell was clicked
 * put the load on the *other* row — the controller typed into the row they
 * meant and watched the weight appear one row up.
 *
 * The clicked cell knows its own row, so that wins. An already-loaded
 * position keeps the variant it was loaded on, and only when neither is
 * known does the first published variant stand in.
 */
export function pickVariant(
  variants: Position[],
  clicked: string | null,
  existing: string | undefined,
): string {
  const has = (uldType: string | null | undefined) =>
    uldType !== null && uldType !== undefined && variants.some((v) => v.uldType === uldType);

  if (has(clicked)) return clicked as string;
  if (has(existing)) return existing as string;
  return variants[0]?.uldType ?? "";
}
