import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { LoadsheetInput } from "./types";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#555555", marginBottom: 8 },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
    borderTop: 1,
    borderColor: "#999999",
    paddingTop: 6,
  },
  headerField: { width: "16.5%", flexDirection: "column" },
  headerLabel: { fontSize: 6.5, color: "#555555" },
  headerValue: { fontSize: 9, fontWeight: 700 },
  ahmRef: { fontSize: 7, color: "#555555", marginBottom: 8 },

  columns: { flexDirection: "row", gap: 12 },
  column: { flex: 1, flexDirection: "column" },

  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 3, textTransform: "uppercase" },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: 1,
    borderColor: "#eeeeee",
    paddingVertical: 2,
  },
  dataLabel: { fontSize: 7.5 },
  dataValue: { fontSize: 7.5, fontWeight: 700 },
  dataMax: { fontSize: 6.5, color: "#777777", marginLeft: 4 },
  emphasisRow: { backgroundColor: "#f5f5f5" },

  compTable: { flexDirection: "column", borderTop: 1, borderColor: "#999999", marginTop: 2 },
  compRow: { flexDirection: "row", borderBottom: 1, borderColor: "#cccccc" },
  compHeaderRow: { backgroundColor: "#f0f0f0", fontWeight: 700 },
  compCell: { padding: 2, borderRight: 1, borderColor: "#cccccc", fontSize: 6.5 },
  colTarget: { width: "50%" },
  colActual: { width: "25%", textAlign: "right" },
  colMax: { width: "25%", textAlign: "right" },

  posList: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 2 },
  posChip: { border: 1, borderColor: "#cccccc", padding: 2, fontSize: 6, width: "12%" },
  posChipCode: { fontWeight: 700 },

  siBox: { marginTop: 8, border: 1, borderColor: "#999999", padding: 5, minHeight: 24 },
  siLabel: { fontSize: 7, fontWeight: 700, marginBottom: 2 },

  lmcBox: { marginTop: 6, border: 1, borderColor: "#999999", padding: 5, minHeight: 16 },
  lmcLabel: { fontSize: 7, fontWeight: 700, marginBottom: 2 },
  lmcRow: { fontSize: 7 },

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

function DataRow({
  label,
  value,
  max,
  emphasis,
}: {
  label: string;
  value: string;
  max?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.dataRow, emphasis ? styles.emphasisRow : {}]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <View style={{ flexDirection: "row" }}>
        <Text style={styles.dataValue}>{value}</Text>
        {max ? <Text style={styles.dataMax}>MAX {max}</Text> : null}
      </View>
    </View>
  );
}

function CompartmentTable({ compartments }: { compartments: LoadsheetInput["compartments"] }) {
  return (
    <View style={styles.compTable}>
      <View style={[styles.compRow, styles.compHeaderRow]}>
        <Text style={[styles.compCell, styles.colTarget]}>COMPARTMENT</Text>
        <Text style={[styles.compCell, styles.colActual]}>ACTUAL</Text>
        <Text style={[styles.compCell, styles.colMax]}>MAX</Text>
      </View>
      {compartments.map((c) => (
        <View key={c.target} style={styles.compRow}>
          <Text style={[styles.compCell, styles.colTarget]}>{c.target.toUpperCase()}</Text>
          <Text style={[styles.compCell, styles.colActual]}>{c.actual}</Text>
          <Text style={[styles.compCell, styles.colMax]}>{c.max}</Text>
        </View>
      ))}
    </View>
  );
}

function PositionList({ cells }: { cells: LoadsheetInput["cells"] }) {
  const occupied = cells.filter((c) => c.weight !== null);
  return (
    <View style={styles.posList}>
      {occupied.map((cell) => (
        <View key={cell.code} style={styles.posChip}>
          <Text style={styles.posChipCode}>{cell.code}</Text>
          <Text>{cell.uldCode ?? cell.awb ?? ""}</Text>
          <Text>{cell.weight}</Text>
        </View>
      ))}
    </View>
  );
}

function LoadsheetDocument({ input }: { input: LoadsheetInput }) {
  return (
    // Fixed creationDate/modificationDate — see lir-document.tsx's identical
    // comment. Determinism applies to document *content*, not render time.
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={styles.page}>
        {input.watermark ? <Text style={styles.watermark}>NOT FOR OPERATIONAL USE</Text> : null}

        <Text style={styles.title}>LOADSHEET</Text>
        <Text style={styles.subtitle}>ALL WEIGHTS IN KILOGRAM</Text>

        <View style={styles.headerGrid}>
          <HeaderField label="FROM" value={input.station} />
          <HeaderField label="TO" value={input.destination} />
          <HeaderField label="FLIGHT" value={input.flightNo} />
          <HeaderField label="A/C REG" value={input.registration} />
          <HeaderField label="VERSION" value={input.version ? `${input.aircraftType} ${input.version}` : input.aircraftType} />
          <HeaderField label="CREW" value={`${input.cockpitCrew}/${input.courierCrew}`} />
          <HeaderField label="DATE" value={input.date} />
          <HeaderField label="TIME" value={input.time} />
          <HeaderField label="PREPARED BY" value={input.preparedBy} />
          <HeaderField label="CHECKED/APPROVED" value={input.checkedBy} />
          <HeaderField label="ED NO" value={input.editionNo} />
        </View>
        <Text style={styles.ahmRef}>
          AHM 560 EDITION {input.ahmEdition} REVISION {input.ahmRevision}
        </Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Weight</Text>
            <DataRow label="DRY OPERATING WEIGHT" value={input.dow} />
            <DataRow label="PASSENGERS" value={String(input.passengerCount)} />
            <DataRow label="CABIN BAGGAGE" value={input.cabinBagWeight} />
            <DataRow label="TOTAL TRAFFIC LOAD" value={input.ttl} />
            <DataRow label="ZERO FUEL WEIGHT" value={input.zfw} max={input.mzfw} emphasis />
            <DataRow label="TAKE OFF FUEL" value={input.takeoffFuel} />
            <DataRow label="TAKE OFF WEIGHT" value={input.tow} max={input.mtow} emphasis />
            <DataRow label="TRIP FUEL" value={input.tripFuel} />
            <DataRow label="LANDING WEIGHT" value={input.ldw} max={input.mlw} emphasis />
            <DataRow label="TAXI FUEL" value={input.taxiFuel} />
            <DataRow label="TAXI WEIGHT" value={input.taxiWeight} max={input.mtw} />
            <DataRow label="UNDERLOAD BEFORE LMC" value={input.underloadBeforeLmc} emphasis />
            <DataRow label="ZFW (CORRECTED)" value={input.zfw} />
            <DataRow label="ZFI (CORRECTED)" value={input.lizfw} />

            <View style={styles.lmcBox}>
              <Text style={styles.lmcLabel}>LAST MINUTE CHANGES</Text>
              {input.lastMinuteChanges.length === 0 ? (
                <Text style={styles.lmcRow}>NIL</Text>
              ) : (
                input.lastMinuteChanges.map((lmc, i) => (
                  <Text key={i} style={styles.lmcRow}>
                    {lmc.position}: {lmc.weightDelta} {lmc.description ?? ""}
                  </Text>
                ))
              )}
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Balance and Seating Conditions</Text>
            <DataRow label="FUEL DENSITY" value={input.fuelDensity} />
            <DataRow label="DOI" value={input.doi} />
            <DataRow label="LIZFW" value={input.lizfw} />
            <DataRow label="MACZFW" value={input.maczfw} emphasis />
            <DataRow label="FWD/AFT ZFW LIMITS: INDEX" value={`${input.zfwForwardLimit} / ${input.zfwAftLimit}`} />
            <DataRow label="LITOW" value={input.litow} />
            <DataRow label="MACTOW" value={input.mactow} emphasis />
            <DataRow label="FWD/AFT TOW LIMITS: INDEX" value={`${input.towForwardLimit} / ${input.towAftLimit}`} />
            <DataRow label="LILAW" value={input.lilaw} />
            <DataRow label="MACLAW" value={input.maclaw} emphasis />
            <DataRow label="TRIM SETTING (STAB)" value={`${input.stab.value} ${input.stab.direction}`} emphasis />

            <Text style={styles.sectionTitle}>Load in Compartments</Text>
            <CompartmentTable compartments={input.compartments} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Load Distribution</Text>
        <PositionList cells={input.cells} />

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
export async function renderLoadsheetPdf(input: LoadsheetInput): Promise<Buffer> {
  return renderToBuffer(<LoadsheetDocument input={input} />);
}
