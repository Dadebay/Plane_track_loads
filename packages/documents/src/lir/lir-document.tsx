import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { chrome, Footer, Watermark } from "../shared/chrome";
import { AirlineLogo } from "../shared/logo";
import { DeckGrid } from "../shared/deck-grid";
import { COLOR, RULE } from "../shared/tokens";
import type { LirCompartmentLimit, LirInput } from "./types";

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

const CERTIFICATION =
  "This aircraft has been loaded in accordance with these instructions including the deviations shown " +
  "in the report. The containers/pallets and bulk-load have been secured in accordance with " +
  "corporation's regulations.";

const styles = StyleSheet.create({
  masthead: {
    flexDirection: "row",
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
  },
  mastheadLogo: {
    width: 92,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: RULE.hairline,
    borderRightStyle: "solid",
    borderRightColor: COLOR.ink,
  },
  mastheadTitle: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderRightWidth: RULE.hairline,
    borderRightStyle: "solid",
    borderRightColor: COLOR.ink,
  },
  titleLine: { fontSize: 9, fontWeight: 700, textAlign: "center", lineHeight: 1.2 },
  mastheadFields: { flex: 1, flexDirection: "column" },

  fieldRow: { flexDirection: "row" },
  fieldRowDivider: { borderTopWidth: RULE.hairline, borderTopStyle: "solid", borderTopColor: COLOR.ink },
  fieldCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderLeftWidth: RULE.hairline,
    borderLeftStyle: "solid",
    borderLeftColor: COLOR.ink,
    justifyContent: "center",
  },
  fieldCellFirst: { borderLeftWidth: 0 },
  fieldLabelRow: { backgroundColor: COLOR.fill },
  fieldLabel: { fontSize: 7, fontWeight: 700, textAlign: "center" },
  fieldValue: { fontSize: 8, textAlign: "center" },

  codesRow: { flexDirection: "row" },
  codesCell: {
    borderLeftWidth: RULE.hairline,
    borderLeftStyle: "solid",
    borderLeftColor: COLOR.ink,
    padding: 3,
  },
  codesCellFirst: { borderLeftWidth: 0 },
  codesStack: { flexDirection: "column" },
  codesDivider: { borderTopWidth: RULE.hairline, borderTopStyle: "solid", borderTopColor: COLOR.ink },
  codesText: { fontSize: 6, lineHeight: 1.35 },

  onload: {
    fontSize: 7,
    fontWeight: 700,
    marginTop: 6,
    alignSelf: "flex-start",
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
  },
  deckTitle: { fontSize: 10, fontWeight: 700, textAlign: "center", marginTop: 6, marginBottom: 5 },

  siBox: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 8,
    gap: 4,
  },
  siLabel: { fontSize: 8, fontWeight: 700, alignSelf: "center" },
  siField: {
    flex: 1,
    minHeight: 34,
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
    padding: 3,
  },
  siText: { fontSize: 7 },


  compartmentBand: { flexDirection: "row", marginBottom: 5, marginLeft: 62 },
  compartmentGroup: {
    flexDirection: "column",
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
    marginRight: -1,
  },
  compartmentGroupName: {
    fontSize: 6,
    fontWeight: 700,
    textAlign: "center",
    paddingVertical: 2,
    borderBottomWidth: RULE.hairline,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR.ink,
  },
  compartmentGap: {
    width: 26,
    backgroundColor: COLOR.blocked,
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
    marginRight: -1,
  },
  compartmentCells: { flexDirection: "row" },
  compartmentCell: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderLeftWidth: RULE.hairline,
    borderLeftStyle: "solid",
    borderLeftColor: COLOR.ink,
  },
  compartmentName: { fontSize: 6, textAlign: "center" },
  compartmentMax: { fontSize: 6, textAlign: "center" },

});

/**
 * The lower-deck limit band: the paired holds carry one combined maximum over
 * the two compartments that share it, each compartment its own sub-limit
 * underneath. Pairing comes from the AHM (`pairedWith`), not from the order
 * the compartments happen to arrive in.
 */
function CompartmentBand({ compartments }: { compartments: LirCompartmentLimit[] }) {
  const groups: LirCompartmentLimit[][] = [];
  const taken = new Set<number>();
  for (const comp of compartments) {
    if (taken.has(comp.number)) continue;
    taken.add(comp.number);
    const partner =
      comp.pairedWith === null ? undefined : compartments.find((c) => c.number === comp.pairedWith);
    if (partner) taken.add(partner.number);
    groups.push(partner ? [comp, partner] : [comp]);
  }

  return (
    <View style={styles.compartmentBand}>
      {groups.map((group, index) => (
        <React.Fragment key={`group-${group[0]!.number}`}>
          {/* The wing box between the forward and aft holds, shaded as the
              plate shades it, so the band lines up with the position rows
              underneath. */}
          {index === 1 ? <View style={styles.compartmentGap} /> : null}
        <View style={[styles.compartmentGroup, { flex: group.length }]}>
          <Text style={styles.compartmentGroupName}>
            {group.length > 1
              ? `${group[0]!.description} MAX ${group[0]!.maxGrossPair} kg`
              : group[0]!.description}
          </Text>
          <View style={styles.compartmentCells}>
            {group.map((comp) => (
              <View key={comp.number} style={styles.compartmentCell}>
                <Text style={styles.compartmentName}>{`Compartment No${comp.number}`}</Text>
                <Text style={styles.compartmentMax}>{`MAX ${comp.lirSubLimit} kg`}</Text>
              </View>
            ))}
          </View>
        </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/** The boxed masthead: mark, document title, the flight's identifying fields
 * and the certification/code strip, all in one frame — the crew reads this
 * block first and has read it in this shape for years. */
function Masthead({ input }: { input: LirInput }) {
  const fields: [string, string][] = [
    ["STATION", input.header.station],
    ["FLIGHT", input.header.flightNo],
    ["DATE", input.header.date],
    ["A/C", input.header.registration],
    ["Prepared by", input.header.preparedBy],
    ["Approved by", input.header.checkedBy],
    ["ED NO", input.header.editionNo],
  ];

  const codeLine = (codes: [string, string][]) => codes.map(([code, label]) => `${code}:${label}`).join("   ");

  return (
    <View style={styles.masthead}>
      <View style={styles.mastheadLogo}>
        <AirlineLogo height={30} />
      </View>
      <View style={styles.mastheadTitle}>
        <Text style={styles.titleLine}>LOADING</Text>
        <Text style={styles.titleLine}>INSTRUCTION</Text>
        <Text style={styles.titleLine}>REPORT</Text>
        <Text style={styles.titleLine}>{input.header.aircraftType}</Text>
      </View>

      <View style={styles.mastheadFields}>
        <View style={[styles.fieldRow, styles.fieldLabelRow]}>
          {fields.map(([label], i) => (
            <View key={label} style={[styles.fieldCell, i === 0 ? styles.fieldCellFirst : {}]}>
              <Text style={styles.fieldLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.fieldRow, styles.fieldRowDivider]}>
          {fields.map(([label, value], i) => (
            <View key={label} style={[styles.fieldCell, i === 0 ? styles.fieldCellFirst : {}]}>
              <Text style={styles.fieldValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.codesRow, styles.fieldRowDivider]}>
          <View style={[styles.codesCell, styles.codesCellFirst, { flex: 2 }]}>
            <Text style={styles.codesText}>{CERTIFICATION}</Text>
            <Text style={styles.codesText}>Person responsible for loading:</Text>
          </View>
          <View style={[styles.codesStack, { flex: 1.5 }]}>
            <View style={styles.codesCell}>
              <Text style={styles.codesText}>{`CODES:  ${codeLine(CONTENT_CODES.slice(0, 4))}`}</Text>
            </View>
            <View style={[styles.codesCell, styles.codesDivider]}>
              <Text style={styles.codesText}>{codeLine(STATUS_CODES)}</Text>
            </View>
          </View>
          <View style={[styles.codesStack, { flex: 1.1 }]}>
            <View style={styles.codesCell}>
              <Text style={styles.codesText}>{codeLine([...CONTENT_CODES.slice(4), ...SIDE_CODES])}</Text>
            </View>
            <View style={[styles.codesCell, styles.codesDivider]}>
              <Text style={styles.codesText}>{codeLine(CONTENT_CODES.slice(0, 4))}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function LirDocument({ input }: { input: LirInput }) {
  return (
    // Fixed creationDate/modificationDate — @react-pdf/renderer defaults
    // both to the current wall-clock time, which would make every render
    // produce different bytes even for identical input. CLAUDE.md's
    // determinism rule applies to document *content*, not to when it was
    // generated, so both are pinned to the epoch rather than surfacing a
    // "generated at" value anywhere in the file.
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={chrome.page}>
        <Watermark show={input.watermark} />

        <Masthead input={input} />

        <Text style={styles.onload}>ONLOAD</Text>

        <Text style={styles.deckTitle}>MAIN DECK</Text>
        <DeckGrid rows={input.layout.main} />

        <Text style={styles.deckTitle}>LOWER DECK</Text>
        <CompartmentBand compartments={input.compartments} />
        <DeckGrid rows={input.layout.lower} alignColumns />

        <View style={styles.siBox}>
          <Text style={styles.siLabel}>SI :</Text>
          <View style={styles.siField}>
            <Text style={styles.siText}>{input.specialInformation}</Text>
          </View>
        </View>

        <Footer documentCode="LIR" header={input.header} watermark={input.watermark} />
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
