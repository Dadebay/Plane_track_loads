import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { chrome, Watermark } from "../shared/chrome";
import { AirlineLogo } from "../shared/logo";
import { COLOR, RULE } from "../shared/tokens";
import type { EdpDeckSection, EdpInput, EdpLine, EdpPositionLine, EdpRow } from "./types";

/**
 * EDP — Loading Instruction / Report, the ramp's working form.
 *
 * Laid out like the sheet the ramp already carries: every position printed
 * with what to load and a ruled blank line to write back what actually went
 * in, two positions across, grouped by compartment with that compartment's
 * published maximum and its planned total. The blank line is the point of the
 * document — the ramp fills it in by hand and it becomes the evidence the LIR
 * is later written from.
 *
 * An empty position prints NOFIT rather than being omitted: a position missing
 * from the sheet is indistinguishable from one nobody checked.
 */

const NOFIT = "NOFIT";

/** The plate's own row label, set the way the ramp sheet prints it:
 * `SINGLE ROW 125" x 96"` reads as `Single Row 125×96`. Wording is the
 * plate's; only its case and the multiplication sign are ours. */
function rowHeadingText(label: string): string {
  return label
    .replace(/"/g, "")
    .replace(/\s*x\s*/gi, "×")
    .toLowerCase()
    .replace(/(^|[\s×/])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\bFt\b/g, "FT");
}
const CERTIFICATION =
  "THIS AIRCRAFT HAS BEEN LOADED IN ACCORDANCE WITH THESE INSTRUCTIONS AND THE DEVIATIONS SHOWN ON THIS " +
  "REPORT. THE CONTAINERS/PALLETS AND BULKLOAD HAVE BEEN SECURED IN ACCORDANCE WITH COMPANY INSTRUCTIONS.";

/**
 * Type sizes for the ramp sheet. Larger than the rest of our documents on
 * purpose: this one is read at the aircraft, in daylight or under a torch,
 * and written on by hand — the LIR's dense tables are read at a desk.
 */
const EDP_FONT = {
  title: 13,
  subtitle: 6.5,
  bandLabel: 6,
  bandValue: 9,
  signoffLabel: 6,
  signoffValue: 8.5,
  blockTitle: 8,
  planned: 8.5,
  compartment: 8.5,
  rowHeading: 7.5,
  code: 8,
  onload: 7,
  report: 7,
  certification: 6.5,
  signature: 7.5,
  pageNumber: 6.5,
} as const;

const styles = StyleSheet.create({
  masthead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  mastheadTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: EDP_FONT.title, fontWeight: 700 },
  subtitle: { fontSize: EDP_FONT.subtitle, color: COLOR.inkMuted, marginTop: 2 },

  signoffFields: { width: 190 },
  signoffRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 3 },
  signoffLabel: { fontSize: EDP_FONT.signoffLabel, color: COLOR.inkMuted, width: 58 },
  signoffValue: {
    flexGrow: 1,
    fontSize: EDP_FONT.signoffValue,
    fontWeight: 700,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
    paddingBottom: 1,
  },

  band: {
    flexDirection: "row",
    marginTop: 8,
    paddingVertical: 4,
    borderTopWidth: RULE.hairline,
    borderTopStyle: "solid",
    borderTopColor: COLOR.ink,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
  },
  bandCell: { paddingRight: 10 },
  bandLabel: { fontSize: EDP_FONT.bandLabel, color: COLOR.inkMuted, marginBottom: 1 },
  bandValue: { fontSize: EDP_FONT.bandValue, fontWeight: 700 },

  blockTitle: {
    fontSize: EDP_FONT.blockTitle,
    fontWeight: 700,
    marginTop: 10,
    paddingBottom: 3,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
  },
  blockTitleMarked: {
    paddingLeft: 5,
    borderLeftWidth: 2,
    borderLeftStyle: "solid",
    borderLeftColor: COLOR.danger,
  },

  plannedLine: { flexDirection: "row", gap: 14, alignItems: "baseline", marginTop: 6, marginBottom: 2 },
  plannedDest: { fontSize: EDP_FONT.planned, fontWeight: 700, color: COLOR.danger },
  plannedEntry: { fontSize: EDP_FONT.planned, fontWeight: 700 },

  compartmentLine: {
    flexDirection: "row",
    gap: 14,
    marginTop: 7,
    paddingBottom: 3,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "dashed",
    borderBottomColor: COLOR.grid,
  },
  compartmentText: { fontSize: EDP_FONT.compartment, fontWeight: 700 },
  totalLine: {
    marginTop: 4,
    paddingTop: 3,
    borderTopWidth: 1.2,
    borderTopStyle: "solid",
    borderTopColor: COLOR.ink,
  },
  totalText: { fontSize: EDP_FONT.compartment, fontWeight: 700 },

  rowHeading: {
    fontSize: EDP_FONT.rowHeading,
    fontWeight: 700,
    marginTop: 9,
    paddingBottom: 3,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
  },

  columns: { flexDirection: "row" },
  column: { flex: 1, paddingRight: 12 },

  entry: {
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "dashed",
    borderBottomColor: COLOR.grid,
    paddingTop: 4,
    paddingBottom: 4,
  },
  codeLine: { flexDirection: "row", gap: 3, alignItems: "baseline" },
  colon: { fontSize: EDP_FONT.code, fontWeight: 700, color: COLOR.danger },
  code: { fontSize: EDP_FONT.code, fontWeight: 700 },
  onload: { flexDirection: "row", gap: 4, marginTop: 2, paddingLeft: 10 },
  onloadLabel: { fontSize: EDP_FONT.onload, fontWeight: 700 },
  onloadValue: { fontSize: EDP_FONT.onload },
  reportRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 2, paddingLeft: 10 },
  reportLabel: { fontSize: EDP_FONT.report, fontWeight: 700 },
  // The line the ramp writes on. Deliberately long and empty.
  reportRule: {
    // Stops short of the column edge, the way the printed sheet rules it:
    // the hand-written figure is short and the gap keeps the two columns
    // visually apart.
    width: "62%",
    marginLeft: 4,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
    height: 8,
  },

  siRule: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
    paddingBottom: 2,
  },
  siLabel: { fontSize: EDP_FONT.blockTitle, fontWeight: 700 },
  siText: { fontSize: EDP_FONT.onload, flexGrow: 1 },
  certification: { fontSize: EDP_FONT.certification, marginTop: 8, lineHeight: 1.4 },

  signatures: { flexDirection: "row", gap: 24, marginTop: 10 },
  signatureBlock: { flex: 1 },
  signatureRole: { fontSize: EDP_FONT.signature, fontWeight: 700 },
  signatureHint: { fontSize: EDP_FONT.certification, color: COLOR.inkSubtle, marginTop: 2 },
  signatureRule: { marginTop: 22, borderTopWidth: 1.2, borderTopStyle: "solid", borderTopColor: COLOR.ink },

  pageNumber: { position: "absolute", bottom: 14, right: 24, fontSize: EDP_FONT.pageNumber, color: COLOR.inkSubtle },
});

function PositionEntry({ position }: { position: EdpPositionLine }) {
  const onload =
    position.destination && position.grossWeight ? `${position.destination} ${position.grossWeight}` : NOFIT;
  return (
    <View style={styles.entry} wrap={false}>
      <View style={styles.codeLine}>
        <Text style={styles.colon}>:</Text>
        <Text style={styles.code}>{position.uldCode ? `${position.code}  ${position.uldCode}` : position.code}</Text>
      </View>
      <View style={styles.onload}>
        <Text style={styles.onloadLabel}>ONLOAD:</Text>
        <Text style={styles.onloadValue}>{onload}</Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>REPORT:</Text>
        <View style={styles.reportRule} />
      </View>
    </View>
  );
}

/** One printed line, kept whole across a page break: two positions side by
 * side, or one on the left when it has no partner. Laying the sheet out line
 * by line (rather than as two long columns) is what lets it break cleanly —
 * two full-height columns cannot split, and @react-pdf squeezes them on top
 * of each other instead. */
function LineRow({ line }: { line: EdpLine }) {
  const [left, right] = line;
  return (
    <View style={styles.columns} wrap={false}>
      <View style={styles.column}>
        <PositionEntry position={left} />
      </View>
      <View style={styles.column}>{right ? <PositionEntry position={right} /> : null}</View>
    </View>
  );
}

function Row({ row }: { row: EdpRow }) {
  const [first, ...rest] = row.lines;
  const heading =
    row.label || row.rightLabel ? (
      <View style={styles.columns}>
        <Text style={[styles.column, styles.rowHeading]}>{rowHeadingText(row.label)}</Text>
        <Text style={[styles.column, styles.rowHeading]}>{row.rightLabel ? rowHeadingText(row.rightLabel) : ""}</Text>
      </View>
    ) : null;

  return (
    <View>
      {/* The heading travels with its first line. A heading alone at the foot
          of a page tells the loader a block starts there and then shows them
          nothing. */}
      <View wrap={false}>
        {heading}
        {first ? <LineRow line={first} /> : null}
      </View>
      {rest.map(([left, right]) => (
        <LineRow key={left.code} line={[left, right]} />
      ))}
    </View>
  );
}

function Section({ section }: { section: EdpDeckSection }) {
  return (
    <View>
      <View style={styles.compartmentLine}>
        <Text style={styles.compartmentText}>{`CPT: ${section.compartment}`}</Text>
        {section.maxLoad ? <Text style={styles.compartmentText}>{`MAX: ${section.maxLoad}`}</Text> : null}
      </View>
      {section.rows.map((row, i) => (
        <Row key={row.label || `row-${i}`} row={row} />
      ))}
      <View style={styles.totalLine}>
        <Text style={styles.totalText}>{`CPT ${section.compartment} TOTAL: ${section.total}`}</Text>
      </View>
    </View>
  );
}

export function EdpDocument({ input }: { input: EdpInput }) {
  const bandFields: { label: string; value: string; width: number }[] = [
    { label: "FROM / TO", value: `${input.from}-${input.to}`, width: 80 },
    { label: "FLIGHT", value: input.header.flightNo, width: 62 },
    { label: "A/C REG", value: input.header.registration, width: 70 },
    { label: "VERSION", value: input.version, width: 62 },
    { label: "DATE", value: input.header.date, width: 82 },
    { label: "TIME", value: input.time, width: 50 },
  ];

  return (
    // Fixed creation/modification dates: a document is identified by its
    // edition, not by when the bytes were produced, and a timestamp would
    // make two renders of the same plan differ (CLAUDE.md rule #5).
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={chrome.page}>
        <Watermark show={input.watermark} />

        <View style={styles.masthead}>
          <View style={styles.mastheadTitle}>
            <AirlineLogo height={24} />
            <View>
              <Text style={styles.title}>LOADING INSTRUCTION / REPORT</Text>
              <Text style={styles.subtitle}>ALL WEIGHTS IN KILOGRAM</Text>
            </View>
          </View>
          <View style={styles.signoffFields}>
            <View style={styles.signoffRow}>
              <Text style={styles.signoffLabel}>PREPARED BY</Text>
              <Text style={styles.signoffValue}>{input.header.preparedBy}</Text>
            </View>
            <View style={styles.signoffRow}>
              <Text style={styles.signoffLabel}>ED NO</Text>
              <Text style={styles.signoffValue}>{input.header.editionNo}</Text>
            </View>
          </View>
        </View>

        <View style={styles.band}>
          {bandFields.map((field) => (
            <View key={field.label} style={[styles.bandCell, { width: field.width }]}>
              <Text style={styles.bandLabel}>{field.label}</Text>
              <Text style={styles.bandValue}>{field.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.blockTitle}>PLANNED LOAD</Text>
        {input.plannedLoad.map((line) => (
          <View key={line.destination} style={styles.plannedLine}>
            <Text style={styles.plannedDest}>{line.destination}</Text>
            {line.entries.map(([code, value]) => (
              <Text key={code} style={styles.plannedEntry}>
                {`${code}  ${value}`}
              </Text>
            ))}
          </View>
        ))}

        <Text style={[styles.blockTitle, styles.blockTitleMarked]}>LOADING INSTRUCTION</Text>
        {input.sections.map((section) => (
          <Section key={section.compartment} section={section} />
        ))}

        <View style={styles.siRule}>
          <Text style={styles.siLabel}>SI</Text>
          <Text style={styles.siText}>{input.specialInformation}</Text>
        </View>
        <Text style={styles.certification}>{CERTIFICATION}</Text>

        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureRole}>LOADSHEET AGENT / LOAD PLANNER</Text>
            <Text style={styles.signatureHint}>SIGNATURE</Text>
            <View style={styles.signatureRule} />
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureRole}>LOADING SUPERVISOR</Text>
            <Text style={styles.signatureHint}>SIGNATURE</Text>
            <View style={styles.signatureRule} />
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function renderEdpPdf(input: EdpInput): Promise<Buffer> {
  return renderToBuffer(<EdpDocument input={input} />);
}
