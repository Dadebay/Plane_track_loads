import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { COLOR, RULE } from "./tokens";
import type { DocumentDeckCell, DocumentDeckRow } from "./types";

/**
 * The loading plate, printed.
 *
 * One row per position configuration, in the order AHM 560 Appendix I s.74
 * prints them, with the row's label boxed in the left gutter — the same rows
 * the load-plan workspace shows on screen, because both come from
 * `buildDeckLayout()` in @tua/wnb-core.
 *
 * Set the way the crew's own plate reads: the position code sits above its
 * box, and the box carries the ULD identifier on the first line and the gross
 * weight on the second, "N" on both when the position is empty. A position
 * blocked by another loaded position's footprint has its box shaded — an
 * empty cell and an unusable cell must not look alike to a loader on the
 * ramp.
 */

const CELL_GAP = 2;

const grid = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 5, alignItems: "flex-end" },
  gutter: {
    width: 58,
    marginRight: 4,
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
    paddingVertical: 3,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  // A configuration printed as two lines (right halves, then left) carries
  // its label against the first line only; the second gets the same space
  // without a box, so the two read as one block.
  gutterContinued: { borderWidth: 0 },
  gutterLabel: { fontSize: 5.5, fontWeight: 700, textAlign: "center" },
  cells: { flex: 1, flexDirection: "row" },
  column: { paddingRight: CELL_GAP },
  code: { fontSize: 6.5, fontWeight: 700, textAlign: "center", marginBottom: 1.5 },
  box: {
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
    paddingVertical: 1,
  },
  boxBlocked: { backgroundColor: COLOR.blocked, borderColor: COLOR.blocked },
  // Holds a column open where a row has no position at all, so the rows below
  // stay under their own numbers.
  boxHidden: { paddingVertical: 1 },
  line: { fontSize: 6, textAlign: "center", paddingVertical: 1, paddingHorizontal: 1 },
  lineWeight: { fontWeight: 700 },
  unavailable: { fontSize: 7, color: COLOR.inkMuted, paddingVertical: 3 },
});

/** The ULD identifier line: inventory code first, then AWB for loose load,
 * then the AHM's "N" for an empty position. */
function identity(cell: DocumentDeckCell): string {
  if (cell.weight === null) return "N";
  return cell.uldCode ?? cell.awb ?? "BULK";
}

/** Shrinks the identifier when it would not fit one grid column. Never
 * truncates: a clipped ULD code names a different container. */
function identityStyle(text: string) {
  if (text.length <= 6) return {};
  return { fontSize: text.length >= 10 ? 3.9 : 4.6, letterSpacing: -0.1 };
}

function Cell({
  cell,
  showIdentity,
  width,
}: {
  cell: DocumentDeckCell;
  showIdentity: boolean;
  width: string;
}) {
  const empty = cell.weight === null;
  const blocked = cell.blocked;

  return (
    <View style={[grid.column, { width }]} wrap={false}>
      {/* The code stays legible on a blocked position too: it sits above the
          box, and a loader looking for that position needs to see that it
          exists and why it cannot be used. */}
      <Text style={grid.code}>{cell.code}</Text>
      <View style={[grid.box, blocked ? grid.boxBlocked : {}]}>
        {showIdentity ? (
          <Text style={[grid.line, identityStyle(identity(cell))]}>{blocked ? " " : identity(cell)}</Text>
        ) : null}
        <Text style={[grid.line, grid.lineWeight]}>{blocked ? " " : empty ? "N" : cell.weight}</Text>
      </View>
    </View>
  );
}

/** A lower-deck position's column on the plate: the number without the size
 * suffix, so `12P` sits under `12` and `12R`/`12L` under it too. */
function columnKey(code: string): string {
  return /^(\d+)/.exec(code)?.[1] ?? code;
}

/**
 * The lower deck's shared column order, in plate order, with the wing box
 * between compartments 2 and 3. Every row is laid out against it, so a
 * pallet row leaves a hole where its container column has no pallet — which
 * is how the plate reads, and why the crew can follow a column down.
 */
function lowerDeckColumns(rows: DocumentDeckRow[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      const key = columnKey(cell.code);
      if (!keys.includes(key)) keys.push(key);
    }
  }
  keys.sort((a, b) => Number(a) - Number(b));

  const withGap: string[] = [];
  keys.forEach((key, i) => {
    const previous = keys[i - 1];
    if (previous?.startsWith("2") && key.startsWith("3")) withGap.push(GAP_COLUMN);
    withGap.push(key);
  });
  return withGap;
}

const GAP_COLUMN = "\u0000gap";

function GapCell({ width, showIdentity }: { width: string; showIdentity: boolean }) {
  return (
    <View style={[grid.column, { width }]}>
      <Text style={grid.code}> </Text>
      <View style={[grid.box, grid.boxBlocked]}>
        {showIdentity ? <Text style={grid.line}> </Text> : null}
        <Text style={[grid.line, grid.lineWeight]}> </Text>
      </View>
    </View>
  );
}

function BlankCell({ width }: { width: string }) {
  return (
    <View style={[grid.column, { width }]}>
      <Text style={grid.code}> </Text>
      <View style={grid.boxHidden}>
        <Text style={grid.line}> </Text>
        <Text style={[grid.line, grid.lineWeight]}> </Text>
      </View>
    </View>
  );
}

export function DeckGrid({
  rows,
  showIdentity = true,
  alignColumns = false,
}: {
  rows: DocumentDeckRow[];
  /** The LIR prints ULD identity and weight; the Loadsheet's distribution
   * block prints weight only, as the reference loadsheet does. */
  showIdentity?: boolean;
  /** Lay every row against one column order (the lower deck). The main
   * deck's rows are alternative configurations of the same floor, not
   * columns of one grid, so they start at the left instead. */
  alignColumns?: boolean;
}) {
  // One column pitch for the whole deck, taken from its widest row, so a
  // position sits in the same place on every configuration row — the way the
  // printed plate aligns them. Rows with fewer positions stop short instead
  // of stretching their cells across the page.
  const columnOrder = alignColumns ? lowerDeckColumns(rows) : [];
  const columns = alignColumns
    ? columnOrder.length
    : rows.reduce((max, row) => Math.max(max, row.cells.length), 1);
  const width = `${(100 / Math.max(columns, 1)).toFixed(4)}%`;

  // An AHM revision whose plate page we do not hold produces no rows
  // (`buildDeckLayout` returns empty rather than guessing). Say so on the
  // document: a silently blank deck reads as "nothing loaded".
  if (rows.length === 0) {
    return (
      <Text style={grid.unavailable}>
        POSITION PLATE NOT AVAILABLE FOR THIS AHM REVISION — POSITIONS NOT PRINTED.
      </Text>
    );
  }

  return (
    <View>
      {rows.map((row) => (
        <View key={row.id} style={grid.row} wrap={false}>
          <View style={[grid.gutter, row.label ? {} : grid.gutterContinued]}>
            <Text style={grid.gutterLabel}>{row.label}</Text>
          </View>
          <View style={grid.cells}>
            {alignColumns
              ? columnOrder.map((key) => {
                  if (key === GAP_COLUMN) {
                    // The wing box only means something to a row that runs
                    // across it. The bulk row sits entirely aft of it, so
                    // shading a column there would invent a break in a row
                    // that has none.
                    const spansGap =
                      row.cells.some((candidate) => columnKey(candidate.code).startsWith("1") || columnKey(candidate.code).startsWith("2")) &&
                      row.cells.some((candidate) => ["3", "4"].includes(columnKey(candidate.code).charAt(0)));
                    return spansGap ? (
                      <GapCell key={`${row.id}/gap`} width={width} showIdentity={showIdentity} />
                    ) : (
                      <BlankCell key={`${row.id}/gap-blank`} width={width} />
                    );
                  }
                  const cell = row.cells.find((candidate) => columnKey(candidate.code) === key);
                  return cell ? (
                    <Cell
                      key={`${row.id}/${cell.code}`}
                      cell={cell}
                      showIdentity={showIdentity}
                      width={width}
                    />
                  ) : (
                    <BlankCell key={`${row.id}/blank-${key}`} width={width} />
                  );
                })
              : row.cells.map((cell) => (
                  <Cell
                    key={`${row.id}/${cell.code}`}
                    cell={cell}
                    showIdentity={showIdentity}
                    width={width}
                  />
                ))}
          </View>
        </View>
      ))}
    </View>
  );
}
