import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { LirCell, LirInput } from "./types";

/**
 * AHM 560 s.18 — LIR header code legend. Fixed IATA/AHM standard codes,
 * not an extracted numeric constant (CLAUDE.md rule #3 concerns
 * per-aircraft AHM data, not universal industry code tables).
 */
const CONTENT_CODES: [string, string][] = [
  ["B", "BAGGAGE"],
  ["C", "CARGO"],
  ["M", "MAIL"],
  ["P", "PALLET"],
  ["S", "RUMMAGE"],
  ["E", "EQUIPMENT"],
];
const STATUS_CODES: [string, string][] = [
  ["O", "FULL"],
  ["X", "EMPTY"],
  ["NIL", "NO CONTAINER OR PALLET OR POSITION"],
];
const SIDE_CODES: [string, string][] = [
  ["R", "RIGHT"],
  ["L", "LEFT"],
];

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  headerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8, borderTop: 1, borderColor: "#999999", paddingTop: 6 },
  headerField: { width: "24%", flexDirection: "column" },
  headerLabel: { fontSize: 7, color: "#555555" },
  headerValue: { fontSize: 9, fontWeight: 700 },
  warning: { fontSize: 7, color: "#555555", marginBottom: 6, fontStyle: "italic" },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 10, borderBottom: 1, borderColor: "#999999", paddingBottom: 6 },
  legendGroup: { flexDirection: "column", gap: 1 },
  legendLine: { fontSize: 7 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  compartmentRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  compartmentBox: { fontSize: 7, border: 1, borderColor: "#cccccc", padding: 3 },
  table: { display: "flex", flexDirection: "column", borderTop: 1, borderColor: "#999999" },
  row: { flexDirection: "row", borderBottom: 1, borderColor: "#cccccc" },
  headerRow: { backgroundColor: "#f0f0f0", fontWeight: 700 },
  emptyRow: { backgroundColor: "#f5f5f5" },
  cell: { padding: 3, borderRight: 1, borderColor: "#cccccc" },
  colPosition: { width: "10%" },
  colMaxGross: { width: "10%" },
  colUld: { width: "40%" },
  colWeight: { width: "40%" },
  cellStack: { flexDirection: "column" },
  cellTop: { fontSize: 7.5 },
  cellBottom: { fontSize: 7.5, fontWeight: 700 },
  siBox: { marginTop: 10, border: 1, borderColor: "#999999", padding: 6, minHeight: 40 },
  siLabel: { fontSize: 7, fontWeight: 700, marginBottom: 3 },
  watermark: {
    position: "absolute",
    top: "45%",
    left: "10%",
    fontSize: 40,
    color: "#cc0000",
    opacity: 0.25,
    transform: "rotate(-30deg)",
  },
});

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.headerField}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerValue}>{value}</Text>
    </View>
  );
}

function CellRow({ cell }: { cell: LirCell }) {
  const isEmpty = cell.weight === null;
  return (
    <View style={[styles.row, isEmpty ? styles.emptyRow : {}]}>
      <Text style={[styles.cell, styles.colPosition]}>{cell.code}</Text>
      <Text style={[styles.cell, styles.colMaxGross]}>{cell.maxGross}</Text>
      <View style={[styles.cell, styles.colUld, styles.cellStack]}>
        <Text style={styles.cellTop}>{isEmpty ? "N" : (cell.uldCode ?? cell.awb ?? "N")}</Text>
      </View>
      <View style={[styles.cell, styles.colWeight, styles.cellStack]}>
        <Text style={styles.cellBottom}>{isEmpty ? "N" : cell.weight}</Text>
      </View>
    </View>
  );
}

function DeckTable({ cells }: { cells: LirCell[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.colPosition]}>POS</Text>
        <Text style={[styles.cell, styles.colMaxGross]}>MAX GROSS</Text>
        <Text style={[styles.cell, styles.colUld]}>ULD / AWB</Text>
        <Text style={[styles.cell, styles.colWeight]}>WEIGHT</Text>
      </View>
      {cells.map((cell) => (
        <CellRow key={cell.code} cell={cell} />
      ))}
    </View>
  );
}

function LirDocument({ input }: { input: LirInput }) {
  const mainDeck = input.cells.filter((c) => c.deck === "MAIN");
  const lowerDeck = input.cells.filter((c) => c.deck === "LOWER");

  return (
    // Fixed creationDate/modificationDate — @react-pdf/renderer defaults
    // both to the current wall-clock time, which would make every render
    // produce different bytes even for identical input. CLAUDE.md's
    // determinism rule applies to document *content*, not to when it was
    // generated, so both are pinned to the epoch rather than surfacing a
    // "generated at" value anywhere in the file.
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={styles.page}>
        {input.watermark ? <Text style={styles.watermark}>NOT FOR OPERATIONAL USE</Text> : null}

        <Text style={styles.title}>LOADING INSTRUCTION / REPORT</Text>

        <View style={styles.headerGrid}>
          <HeaderField label="STATION" value={input.station} />
          <HeaderField label="FLIGHT" value={input.flightNo} />
          <HeaderField label="DATE" value={input.date} />
          <HeaderField label="A/C" value={`${input.registration} (${input.aircraftType})`} />
          <HeaderField label="PREPARED BY" value={input.preparedBy} />
          <HeaderField label="CHECKED BY" value={input.checkedBy} />
          <HeaderField label="ED NO" value={input.editionNo} />
        </View>

        <Text style={styles.warning}>
          This report must be checked against the actual aircraft load before departure. Not valid for load
          calculation until agreed with Load Control.
        </Text>

        <View style={styles.legendRow}>
          <View style={styles.legendGroup}>
            {CONTENT_CODES.map(([code, label]) => (
              <Text key={code} style={styles.legendLine}>
                {code} = {label}
              </Text>
            ))}
          </View>
          <View style={styles.legendGroup}>
            {STATUS_CODES.map(([code, label]) => (
              <Text key={code} style={styles.legendLine}>
                {code} = {label}
              </Text>
            ))}
          </View>
          <View style={styles.legendGroup}>
            {SIDE_CODES.map(([code, label]) => (
              <Text key={code} style={styles.legendLine}>
                {code} = {label}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>MAIN DECK (max {input.mainDeckMaxLoad} kg)</Text>
        <DeckTable cells={mainDeck} />

        <Text style={styles.sectionTitle}>LOWER DECK</Text>
        <View style={styles.compartmentRow}>
          {input.compartments.map((comp) => (
            <Text key={comp.number} style={styles.compartmentBox}>
              COMP {comp.number} ({comp.description}) MAX {comp.lirSubLimit} kg
            </Text>
          ))}
        </View>
        <DeckTable cells={lowerDeck} />

        <View style={styles.siBox}>
          <Text style={styles.siLabel}>SI (SPECIAL INFORMATION)</Text>
          <Text>{input.specialInformation || "—"}</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Deterministic — identical `input` always renders identical bytes (no
 * wall-clock timestamp anywhere in the document), per CLAUDE.md's
 * "aynı girdi → byte-identical çıktı" requirement for safety documents. */
export async function renderLirPdf(input: LirInput): Promise<Buffer> {
  return renderToBuffer(<LirDocument input={input} />);
}
