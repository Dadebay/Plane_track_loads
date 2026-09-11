import { positionKey } from "./position-conflicts";
import type { Deck, Position, PositionConfiguration } from "./types";

/**
 * The aircraft's printed loading plate, as data.
 *
 * AHM 560 Appendix I s.74 prints each deck as a stack of alternative row
 * configurations — single row 88x125, single row 96x125, the 125" bridge,
 * the two side-by-side rows, the long pallets, then the lower deck. Three
 * consumers need that same stack: the load-plan workspace on screen, the
 * LIR PDF's position grid, and the Loadsheet's load distribution block. If
 * each derived it separately they could disagree about which positions
 * exist on a row or in what order — and a position missing from a printed
 * LIR is a loading error.
 *
 * So the grouping lives here once: pure, framework-free, and fed entirely
 * from versioned AHM data (CLAUDE.md rules #1 and #3). Cell *state*
 * (loaded, blocked, overloaded) is not part of it — that is the workspace's
 * job, layered on top.
 */

export interface DeckLayoutCell {
  /** `uldType/code` — unique across the whole plate. */
  key: string;
  code: string;
  uldType: string;
  maxGross: string;
}

export interface DeckLayoutRow {
  id: string;
  label: string;
  deck: Deck;
  cells: DeckLayoutCell[];
}

export interface DeckLayout {
  main: DeckLayoutRow[];
  lower: DeckLayoutRow[];
}

/**
 * Rows in `positionConfigurations` order (the plate's own top-to-bottom
 * order), cells in `positions` order (the plate's own left-to-right order).
 * Empty rows are dropped: a configuration with no published position on
 * this airframe has nothing to print.
 *
 * `configurations` is null for an AHM revision whose plate page we do not
 * hold — the result is then empty rather than invented, and callers show
 * their own "layout unavailable" state.
 */
export function buildDeckLayout(
  positions: Position[],
  configurations: PositionConfiguration[] | null,
): DeckLayout {
  const rows: DeckLayoutRow[] = (configurations ?? []).map((configuration) => ({
    id: configuration.id,
    label: configuration.label,
    deck: configuration.deck,
    cells: positions
      .filter((position) => position.uldType === configuration.id)
      .map((position) => ({
        key: positionKey(position.uldType, position.code),
        code: position.code,
        uldType: position.uldType,
        maxGross: position.maxGross,
      })),
  }));

  return {
    main: rows.filter((row) => row.deck === "MAIN" && row.cells.length > 0),
    lower: rows.filter((row) => row.deck === "LOWER" && row.cells.length > 0),
  };
}
