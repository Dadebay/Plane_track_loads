/**
 * Flight Schedule PDF — Faz 6, `/schedule` page's "Export PDF" action.
 *
 * A simple operational listing, not a W&B calculation output (LIR /
 * Loadsheet / CG Envelope / NOTOC), so the NOT FOR OPERATIONAL USE
 * watermark (CLAUDE.md rule #8, tied to wnb-core validation status)
 * does not apply here. Always English (CLAUDE.md rule #4).
 */

import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface ScheduleListFlight {
  flightNo: string;
  date: string;
  status: string;
  serviceType: string;
  aircraftRegistration: string;
  aircraftType: string;
  route: string;
  stdDep: string;
  staArr: string;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555555", marginBottom: 12 },
  table: { display: "flex", flexDirection: "column", borderTop: 1, borderColor: "#999999" },
  row: { flexDirection: "row", borderBottom: 1, borderColor: "#cccccc" },
  headerRow: { backgroundColor: "#f0f0f0", fontWeight: 700 },
  cell: { padding: 4, borderRight: 1, borderColor: "#cccccc" },
  colStatus: { width: "10%" },
  colDate: { width: "10%" },
  colFlightNo: { width: "10%" },
  colRoute: { width: "14%" },
  colStd: { width: "13%" },
  colSta: { width: "13%" },
  colReg: { width: "10%" },
  colType: { width: "10%" },
  colSvc: { width: "10%" },
});

function ScheduleListDocument({
  flights,
  generatedAt,
}: {
  flights: ScheduleListFlight[];
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Flight Schedule</Text>
        <Text style={styles.subtitle}>Generated {generatedAt} UTC</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.colStatus]}>Status</Text>
            <Text style={[styles.cell, styles.colDate]}>Date</Text>
            <Text style={[styles.cell, styles.colFlightNo]}>Flt No</Text>
            <Text style={[styles.cell, styles.colRoute]}>Route</Text>
            <Text style={[styles.cell, styles.colStd]}>STD</Text>
            <Text style={[styles.cell, styles.colSta]}>STA</Text>
            <Text style={[styles.cell, styles.colReg]}>Reg</Text>
            <Text style={[styles.cell, styles.colType]}>Type</Text>
            <Text style={[styles.cell, styles.colSvc]}>Svc Type</Text>
          </View>
          {flights.map((f, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.cell, styles.colStatus]}>{f.status}</Text>
              <Text style={[styles.cell, styles.colDate]}>{f.date}</Text>
              <Text style={[styles.cell, styles.colFlightNo]}>{f.flightNo}</Text>
              <Text style={[styles.cell, styles.colRoute]}>{f.route}</Text>
              <Text style={[styles.cell, styles.colStd]}>{f.stdDep}</Text>
              <Text style={[styles.cell, styles.colSta]}>{f.staArr}</Text>
              <Text style={[styles.cell, styles.colReg]}>{f.aircraftRegistration}</Text>
              <Text style={[styles.cell, styles.colType]}>{f.aircraftType}</Text>
              <Text style={[styles.cell, styles.colSvc]}>{f.serviceType}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderScheduleListPdf(flights: ScheduleListFlight[]): Promise<Buffer> {
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16);
  return renderToBuffer(<ScheduleListDocument flights={flights} generatedAt={generatedAt} />);
}
