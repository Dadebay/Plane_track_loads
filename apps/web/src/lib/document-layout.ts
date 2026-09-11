/**
 * The bridge between a load plan and the printed documents.
 *
 * LIR, Loadsheet and ENV all take plain data, and all three must show the
 * plate the controller actually worked on. So the document input is built
 * from the *same* `buildWorkspace()` the load-plan screen renders — one
 * layout, three outputs — plus the tare/net breakdown and the AWB the
 * workspace itself has no reason to carry.
 *
 * Nothing here formats numbers: weights go to the document as the Decimal
 * strings the database and @tua/wnb-core produced (CLAUDE.md rule #2 —
 * rounding is presentation, and these documents print the exact figure the
 * calculation used).
 */

import { Decimal } from "decimal.js";
import { buildPositionFootprints, type PositionFootprint } from "@tua/wnb-core";
import type {
  DocumentDeckLayout,
  DocumentDeckRow,
  DocumentUldLine,
  EdpDeckSection,
  EdpPlannedLoadLine,
  EdpLine,
  EdpPositionLine,
  EdpRow,
} from "@tua/documents";
import { getPositionRect } from "./aircraft-layout";
import type { DraftLoadItem, LoadPlanAhmData } from "./load-plan-calc";
import { buildWorkspace, type WorkspaceRow } from "./position-workspace";

function footprintsFor(ahmData: LoadPlanAhmData): PositionFootprint[] {
  if (!ahmData.positionConfigurations) return [];
  return buildPositionFootprints(
    ahmData.positions,
    ahmData.positionConfigurations,
    ahmData.indexFormula,
    ahmData.halfContainerPositions,
  );
}

/** True for the right half of a side-by-side pair. The base must be a code in
 * its own right (two characters or more): the main deck's single-letter `L`
 * and `R` are two full-width places, not halves. */
function isHalf(code: string, side: "L" | "R"): boolean {
  return code.endsWith(side) && code.length >= 3;
}

function toDocumentRows(rows: WorkspaceRow[], items: DraftLoadItem[]): DocumentDeckRow[] {
  const awbByPosition = new Map(items.map((item) => [item.position, item.awb ?? null]));

  const toCell = (cell: WorkspaceRow["cells"][number]) => ({
    code: cell.code,
    maxGross: cell.maxGross,
    uldCode: cell.uldCode,
    awb: awbByPosition.get(cell.code) ?? null,
    weight: cell.weight,
    blocked: cell.state === "BLOCKED",
  });

  return rows.flatMap((row) => {
    const right = row.cells.filter((cell) => isHalf(cell.code, "R"));
    const left = row.cells.filter((cell) => isHalf(cell.code, "L"));

    // A side-by-side configuration prints as two lines — every right half,
    // then every left half — the way the plate is laid out, instead of
    // alternating R/L across one line. The label is set against the first of
    // the two, which is where the crew's sheet carries it.
    if (right.length > 0 && left.length > 0 && right.length + left.length === row.cells.length) {
      return [
        { id: `${row.id}/R`, label: row.label, cells: right.map(toCell) },
        { id: `${row.id}/L`, label: "", cells: left.map(toCell) },
      ];
    }

    return [{ id: row.id, label: row.label, cells: row.cells.map(toCell) }];
  });
}

/** The plate, with this plan's load on it. */
export function buildDocumentLayout(
  ahmData: LoadPlanAhmData,
  items: DraftLoadItem[],
): DocumentDeckLayout {
  // A finalized plan is what documents are generated from, so no cell is
  // read-only or overloaded from the document's point of view — the
  // limit checks are printed as their own table instead.
  const workspace = buildWorkspace(ahmData, items, footprintsFor(ahmData), new Set(), false);
  return {
    main: toDocumentRows(workspace.main, items),
    lower: toDocumentRows(workspace.lower, items),
  };
}

/**
 * The loaded ULDs, forward to aft — the order a loader walks the aircraft,
 * and the order the plate prints. `tareWeight`/`netWeight` are null for
 * loose load and for rows entered before the breakdown existed; gross is
 * always present, because gross is what W&B consumed.
 */
export function buildUldLines(
  ahmData: LoadPlanAhmData,
  items: DraftLoadItem[],
): DocumentUldLine[] {
  const deckByPosition = new Map(ahmData.positions.map((p) => [p.code, p.deck]));

  return [...items]
    .sort((a, b) => {
      const deckA = deckByPosition.get(a.position) ?? "MAIN";
      const deckB = deckByPosition.get(b.position) ?? "MAIN";
      if (deckA !== deckB) return deckA === "MAIN" ? -1 : 1;
      const rectA = getPositionRect(a.position, deckA);
      const rectB = getPositionRect(b.position, deckB);
      return (rectA?.x ?? 0) - (rectB?.x ?? 0);
    })
    .map((item) => ({
      position: item.position,
      uldCode: item.uldCode ?? null,
      awb: item.awb ?? null,
      contentCode: item.contentCode ?? null,
      tareWeight: item.tareWeight ?? null,
      netWeight: item.netWeight ?? null,
      grossWeight: item.weight,
    }));
}

/** The left half of a side-by-side pair, or null. The base must be a code in
 * its own right (at least two characters): the main deck has single-letter
 * positions `L` and `R`, which are two separate full-width places, not the
 * halves of one. */
function leftHalfBase(code: string): string | null {
  if (!code.endsWith("L")) return null;
  const base = code.slice(0, -1);
  return base.length >= 2 ? base : null;
}

/** Pairs a block's left/right halves onto one line — `41L` beside `41R`,
 * `ABL` beside `ABR`. Returns null when the block has no halves at all, which
 * is how a block that prints as a single column is recognised. */
function pairLeftRight(entries: EdpPositionLine[]): EdpLine[] | null {
  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  const siblingOf = (code: string) => {
    const base = leftHalfBase(code);
    return base ? byCode.get(`${base}R`) : undefined;
  };
  const hasPair = entries.some((entry) => siblingOf(entry.code) !== undefined);
  if (!hasPair) return null;

  // The plate lists the right half before the left (ABR, ABL, BCR, BCL...),
  // so the right halves that belong to a pair are collected first and then
  // skipped: each pair is emitted once, at its left half.
  const rightHalves = new Set(
    entries.map((entry) => siblingOf(entry.code)?.code).filter((code): code is string => code !== undefined),
  );

  const lines: EdpLine[] = [];
  for (const entry of entries) {
    if (rightHalves.has(entry.code)) continue;
    lines.push([entry, siblingOf(entry.code) ?? null]);
  }
  return lines;
}

const singleColumn = (entries: EdpPositionLine[]): EdpLine[] => entries.map((entry) => [entry, null]);

/** A block this long is one of the full-deck configurations; the sheet runs
 * two of those side by side, and prints the short blocks (the pallet rows) one
 * under the other in a single column. */
const SIDE_BY_SIDE_MIN_POSITIONS = 10;

/**
 * The EDP's loading instruction, one block per compartment.
 *
 * The ramp form prints every position, loaded or not, so it is built from the
 * same workspace as the LIR rather than from the loaded items alone.
 *
 * The main deck is one block with the published deck maximum; the lower deck
 * is split the way the AHM limits it — per compartment — and a lower-deck
 * position code carries its compartment as its leading digit (41, 41L, 41P are
 * all compartment 4). Each block prints its own planned total, because that
 * total against MAX is the check the ramp actually makes.
 */
export function buildEdpSections(
  ahmData: LoadPlanAhmData,
  items: DraftLoadItem[],
  destination: string,
): EdpDeckSection[] {
  const workspace = buildWorkspace(ahmData, items, footprintsFor(ahmData), new Set(), false);

  const toLine = (cell: WorkspaceRow["cells"][number]): EdpPositionLine => ({
    code: cell.code,
    uldCode: cell.uldCode,
    // An empty or blocked cell has nothing to load, and prints NOFIT.
    destination: cell.weight ? destination : null,
    grossWeight: cell.weight,
  });

  const total = (lines: EdpLine[]): string =>
    lines
      .flat()
      .reduce((sum, line) => (line?.grossWeight ? sum.plus(new Decimal(line.grossWeight)) : sum), new Decimal(0))
      .toString();

  // Each configuration row becomes a block: halves across the two columns
  // where the configuration has them, one column otherwise.
  const blocks = workspace.main.map((row) => {
    const entries = row.cells.map(toLine);
    const paired = pairLeftRight(entries);
    return { label: row.label, entries, lines: paired ?? singleColumn(entries), paired: paired !== null };
  });

  const mainRows: EdpRow[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const left = blocks[i]!;
    const right = blocks[i + 1];
    const runSideBySide =
      !left.paired &&
      right !== undefined &&
      !right.paired &&
      left.entries.length >= SIDE_BY_SIDE_MIN_POSITIONS &&
      right.entries.length >= SIDE_BY_SIDE_MIN_POSITIONS;

    if (!runSideBySide) {
      mainRows.push({ label: left.label, lines: left.lines });
      continue;
    }

    const height = Math.max(left.entries.length, right.entries.length);
    const lines: EdpLine[] = [];
    for (let k = 0; k < height; k++) {
      const leftEntry = left.entries[k];
      const rightEntry = right.entries[k];
      if (!leftEntry && !rightEntry) continue;
      // A block that runs out of positions before its neighbour still holds
      // its side of the line open, so the columns stay aligned.
      lines.push(leftEntry ? [leftEntry, rightEntry ?? null] : [rightEntry!, null]);
    }
    mainRows.push({ label: left.label, rightLabel: right.label, lines });
    i++;
  }

  const sections: EdpDeckSection[] = [
    {
      compartment: "MD",
      maxLoad: ahmData.mainDeckMaxLoad,
      total: total(mainRows.flatMap((row) => row.lines)),
      rows: mainRows,
    },
  ];

  // One entry per position code, in plate order. A code published at two ULD
  // sizes is one physical place on the aircraft and prints once.
  const cellsByCompartment = new Map<string, EdpPositionLine[]>();
  const seen = new Set<string>();
  for (const row of workspace.lower) {
    for (const cell of row.cells) {
      if (seen.has(cell.code)) continue;
      seen.add(cell.code);
      const compartment = /^(\d)/.exec(cell.code)?.[1];
      if (!compartment) continue;
      const entries = cellsByCompartment.get(compartment) ?? [];
      entries.push(toLine(cell));
      cellsByCompartment.set(compartment, entries);
    }
  }

  for (const compartment of [...cellsByCompartment.keys()].sort()) {
    const entries = cellsByCompartment.get(compartment)!;
    const lines = pairLeftRight(entries) ?? singleColumn(entries);
    const published = ahmData.compartments.find((c) => String(c.number) === compartment);
    sections.push({
      compartment,
      // The LIR sub-limit is the per-compartment figure the plate prints as
      // MAX; a compartment we hold no row for prints none rather than a
      // computed stand-in (CLAUDE.md rule #3).
      maxLoad: published?.lirSubLimit ?? null,
      total: total(lines),
      rows: [{ label: "", lines }],
    });
  }

  return sections;
}

/**
 * The load categories the ramp sheet prints, in its own order: cargo,
 * courier, mail, baggage, other. Every category is printed whether or not
 * this flight carries it — a blank category and a category nobody entered
 * look the same otherwise, so an absent one reads "nill".
 */
const PLANNED_LOAD_CATEGORIES = ["C", "Y", "M", "B", "O"] as const;
const NIL = "nill";

/**
 * PLANNED LOAD — what is going to the downline station, by category.
 *
 * Loose load carries no content code; it is counted as cargo, the category
 * the ramp reads it as. Decimal throughout (CLAUDE.md rule #2).
 */
export function buildEdpPlannedLoad(items: DraftLoadItem[], destination: string): EdpPlannedLoadLine[] {
  const byCode = new Map<string, Decimal>();
  for (const item of items) {
    const code = item.contentCode ?? "C";
    byCode.set(code, (byCode.get(code) ?? new Decimal(0)).plus(new Decimal(item.weight)));
  }

  // A category the operator used but the sheet does not list still prints —
  // dropping load off the ramp's copy is not an option.
  const extra = [...byCode.keys()].filter((code) => !PLANNED_LOAD_CATEGORIES.includes(code as never)).sort();

  return [
    {
      destination,
      entries: [...PLANNED_LOAD_CATEGORIES, ...extra].map(
        (code) => [code, byCode.get(code)?.toString() ?? NIL] as [string, string],
      ),
    },
  ];
}
