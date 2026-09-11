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
  line: { fontSize: 6, textAlign: "center", paddingVertical: 1 },
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
  return { fontSize: text.length >= 10 ? 4.2 : 4.8, letterSpacing: -0.1 };
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

export function DeckGrid({
  rows,
  showIdentity = true,
}: {
  rows: DocumentDeckRow[];
  /** The LIR prints ULD identity and weight; the Loadsheet's distribution
   * block prints weight only, as the reference loadsheet does. */
  showIdentity?: boolean;
}) {
  // One column pitch for the whole deck, taken from its widest row, so a
  // position sits in the same place on every configuration row — the way the
  // printed plate aligns them. Rows with fewer positions stop short instead
  // of stretching their cells across the page.
  const columns = rows.reduce((max, row) => Math.max(max, row.cells.length), 1);
  const width = `${(100 / columns).toFixed(4)}%`;

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
            {row.cells.map((cell) => (
              <Cell key={`${row.id}/${cell.code}`} cell={cell} showIdentity={showIdentity} width={width} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
