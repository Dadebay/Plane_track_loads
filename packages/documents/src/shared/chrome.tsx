import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { COLOR, FONT, PAGE, RULE } from "./tokens";
import { AirlineLogo } from "./logo";
import type { DocumentHeader } from "./types";

/**
 * The page furniture every document shares: the branded block, the boxed
 * field bands, the watermark, the SI area and the section rules.
 *
 * Widths are expressed as flex weights, never as percentages or fixed
 * point widths. That is deliberate: the reference ENV's own header runs
 * off the right edge of the page and clips "ED NO" to "1?8" (Bulgu #6),
 * which is exactly what a hand-totalled percentage row does when someone
 * adds a field later. A flex row cannot overflow its parent, so the defect
 * is structurally impossible here rather than merely fixed once.
 */

export const chrome = StyleSheet.create({
  page: {
    padding: PAGE.padding,
    fontSize: PAGE.baseFontSize,
    fontFamily: FONT.family,
    color: COLOR.ink,
  },

  brandBlock: {
    width: 108,
    borderRightWidth: RULE.hairline,
    borderRightStyle: "solid",
    borderColor: COLOR.hairline,
    paddingRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  titleBlock: { width: 122, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  title: { fontSize: FONT.title, fontWeight: 700, textAlign: "center", lineHeight: 1.1 },
  subtitle: { fontSize: FONT.micro, color: COLOR.inkMuted, textAlign: "center", marginTop: 1 },

  headerBand: {
    flexDirection: "row",
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.hairline,
    marginBottom: 6,
  },
  bandFields: { flex: 1, flexDirection: "column" },

  fieldRow: { flexDirection: "row" },
  fieldCell: {
    flexDirection: "column",
    borderLeftWidth: RULE.hairline,
    borderLeftStyle: "solid",
    borderColor: COLOR.hairline,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  fieldCellFirst: { borderLeft: 0 },
  fieldRowDivider: { borderTopWidth: RULE.hairline, borderTopStyle: "solid", borderColor: COLOR.hairline },
  fieldLabel: {
    fontSize: FONT.micro,
    color: COLOR.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  fieldValue: { fontSize: FONT.body, fontWeight: 700 },

  noteBox: {
    borderTopWidth: RULE.hairline,
    borderTopStyle: "solid",
    borderColor: COLOR.hairline,
    paddingTop: 3,
    marginBottom: 5,
  },
  noteText: { fontSize: FONT.micro, color: COLOR.inkMuted },

  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitleCentred: { textAlign: "center" },

  siBox: {
    marginTop: 6,
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.hairline,
    padding: 4,
    minHeight: 30,
  },
  siLabel: { fontSize: FONT.micro, fontWeight: 700, marginBottom: 2 },
  siText: { fontSize: FONT.body },

  footer: {
    position: "absolute",
    bottom: 10,
    left: PAGE.padding,
    right: PAGE.padding,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: FONT.micro, color: COLOR.inkSubtle },

  watermark: {
    position: "absolute",
    top: "45%",
    left: "10%",
    fontSize: 40,
    color: COLOR.danger,
    opacity: 0.25,
    transform: "rotate(-30deg)",
  },
});

export interface Field {
  label: string;
  value: string;
  /** Relative width. Defaults to 1 — a row of five fields splits evenly. */
  flex?: number;
}

/** The airline block: the operator's own mark (see shared/logo.tsx) with the
 * wordmark beneath it. */
export function Brand() {
  return (
    <View style={chrome.brandBlock}>
      <AirlineLogo height={22} />
    </View>
  );
}

export function FieldRow({ fields, divider }: { fields: Field[]; divider?: boolean }) {
  return (
    <View style={[chrome.fieldRow, divider ? chrome.fieldRowDivider : {}]}>
      {fields.map((field, i) => (
        <View
          key={field.label}
          style={[chrome.fieldCell, { flex: field.flex ?? 1 }, i === 0 ? chrome.fieldCellFirst : {}]}
        >
          <Text style={chrome.fieldLabel}>{field.label}</Text>
          <Text style={chrome.fieldValue}>{field.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The shared top band: brand, document title, then one or more field rows.
 * `rows` is whatever that document prints — LIR and ENV carry the
 * station/flight/date/registration set, the Loadsheet adds leg, version,
 * crew and time.
 */
export function DocumentBand({
  title,
  subtitle,
  rows,
}: {
  /** An array is printed one line per entry — the document titles are set
   * in a narrow block, and letting @react-pdf hyphenate them produced
   * "LOADING IN-STRUCTION". Where the line breaks is a typographic
   * decision, so it belongs to the caller. */
  title: string | string[];
  subtitle?: string;
  rows: Field[][];
}) {
  const titleLines = Array.isArray(title) ? title : [title];
  return (
    <View style={chrome.headerBand}>
      <Brand />
      <View style={chrome.titleBlock}>
        {titleLines.map((line) => (
          <Text key={line} style={chrome.title}>
            {line}
          </Text>
        ))}
        {subtitle ? <Text style={chrome.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={chrome.bandFields}>
        {rows.map((row, i) => (
          <FieldRow key={row.map((f) => f.label).join("|")} fields={row} divider={i > 0} />
        ))}
      </View>
    </View>
  );
}

/** The standard header field set, in the reference's own order. */
export function headerFields(header: DocumentHeader): Field[][] {
  return [
    [
      { label: "STATION", value: header.station },
      { label: "FLIGHT", value: header.flightNo },
      { label: "DATE", value: header.date, flex: 1.2 },
      { label: "ED NO", value: header.editionNo, flex: 0.7 },
    ],
    [
      { label: "A/C TYPE", value: header.aircraftType, flex: 1.6 },
      { label: "A/C REG", value: header.registration },
      { label: "PREPARED BY", value: header.preparedBy, flex: 1.2 },
      { label: "CHECKED BY", value: header.checkedBy, flex: 1.2 },
    ],
  ];
}

export function Watermark({ show }: { show: boolean }) {
  return show ? <Text style={chrome.watermark}>NOT FOR OPERATIONAL USE</Text> : null;
}

export function SiBox({ text }: { text: string }) {
  return (
    <View style={chrome.siBox}>
      <Text style={chrome.siLabel}>SI (SPECIAL INFORMATION)</Text>
      <Text style={chrome.siText}>{text || "NIL"}</Text>
    </View>
  );
}

/**
 * Footer. Carries the edition and the watermark status in words, so a
 * photocopy of a single page still says what it is. No generation
 * timestamp — that would break byte-determinism.
 */
export function Footer({
  documentCode,
  header,
  watermark,
}: {
  documentCode: string;
  header: DocumentHeader;
  watermark: boolean;
}) {
  return (
    <View style={chrome.footer} fixed>
      <Text style={chrome.footerText}>
        {documentCode} {header.flightNo} {header.date} {header.registration} ED{header.editionNo}
      </Text>
      <Text
        style={chrome.footerText}
        render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`}
      />
      <Text style={chrome.footerText}>{watermark ? "NOT FOR OPERATIONAL USE" : "OPERATIONAL"}</Text>
    </View>
  );
}
