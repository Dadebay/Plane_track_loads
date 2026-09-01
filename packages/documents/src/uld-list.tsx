/**
 * ULD Stock PDF — Faz 7, `/uld` page's "Export PDF" action. A flat listing,
 * not a W&B calculation output, so the operational-use watermark doesn't
 * apply (see schedule-list.tsx for the same reasoning). Always English
 * (CLAUDE.md rule #4).
 */

import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface UldListRow {
  baseplateCode: string;
  code: string;
  typeCode: string;
  serial: string;
  ownerCode: string;
  assignedStation: string;
  currentStation: string;
  status: string;
  condition: string;
  flight: string;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555555", marginBottom: 12 },
  table: { display: "flex", flexDirection: "column", borderTop: 1, borderColor: "#999999" },
  row: { flexDirection: "row", borderBottom: 1, borderColor: "#cccccc" },
  headerRow: { backgroundColor: "#f0f0f0", fontWeight: 700 },
  cell: { padding: 4, borderRight: 1, borderColor: "#cccccc" },
  colBaseplate: { width: "9%" },
  colCode: { width: "13%" },
  colType: { width: "8%" },
  colSerial: { width: "10%" },
  colOwner: { width: "8%" },
  colAssigned: { width: "10%" },
  colCurrent: { width: "10%" },
  colStatus: { width: "10%" },
  colCondition: { width: "12%" },
  colFlight: { width: "10%" },
});

function UldListDocument({ rows, generatedAt }: { rows: UldListRow[]; generatedAt: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>ULD Stock</Text>
        <Text style={styles.subtitle}>Generated {generatedAt} UTC</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.colBaseplate]}>Baseplate</Text>
            <Text style={[styles.cell, styles.colCode]}>ULD Code</Text>
            <Text style={[styles.cell, styles.colType]}>Type</Text>
            <Text style={[styles.cell, styles.colSerial]}>Serial</Text>
            <Text style={[styles.cell, styles.colOwner]}>Owner</Text>
            <Text style={[styles.cell, styles.colAssigned]}>Assigned</Text>
            <Text style={[styles.cell, styles.colCurrent]}>Current</Text>
            <Text style={[styles.cell, styles.colStatus]}>Status</Text>
            <Text style={[styles.cell, styles.colCondition]}>Condition</Text>
            <Text style={[styles.cell, styles.colFlight]}>Flight</Text>
          </View>
          {rows.map((r, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.cell, styles.colBaseplate]}>{r.baseplateCode}</Text>
              <Text style={[styles.cell, styles.colCode]}>{r.code}</Text>
              <Text style={[styles.cell, styles.colType]}>{r.typeCode}</Text>
              <Text style={[styles.cell, styles.colSerial]}>{r.serial}</Text>
              <Text style={[styles.cell, styles.colOwner]}>{r.ownerCode}</Text>
              <Text style={[styles.cell, styles.colAssigned]}>{r.assignedStation}</Text>
              <Text style={[styles.cell, styles.colCurrent]}>{r.currentStation}</Text>
              <Text style={[styles.cell, styles.colStatus]}>{r.status}</Text>
              <Text style={[styles.cell, styles.colCondition]}>{r.condition}</Text>
              <Text style={[styles.cell, styles.colFlight]}>{r.flight}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderUldListPdf(rows: UldListRow[]): Promise<Buffer> {
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16);
  return renderToBuffer(<UldListDocument rows={rows} generatedAt={generatedAt} />);
}
