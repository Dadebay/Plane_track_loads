import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { Watermark } from "../shared/chrome";
import { AirlineLogo } from "../shared/logo";
import type { DocumentDeckCell, DocumentDeckRow } from "../shared/types";
import type { LoadsheetInput } from "./types";

/**
 * Loadsheet — a faithful reproduction of the operator's printed LOADSHEET.
 *
 * Every coordinate below is measured from the reference document
 * (LS_T5 3431 10/09/2026 ED04, A4 595.28 x 841.89 pt) and is expressed in
 * PDF points, so the printed sheet a load controller already knows stays
 * recognisable down to the field positions: same two header bands, same
 * weight-distribution grid, same row order, same labels.
 *
 * Only the *values* come from this system — and only from @tua/wnb-core
 * via the caller (CLAUDE.md rules #1 and #3). Two things the reference
 * does not print are kept because this project requires them: LILAW/MACLAW
 * and the AHM edition/revision (Bulgu #2 and #5) are placed in the
 * reference's own "CAPTAIN INFORMATION / NOTES" area rather than in new
 * furniture, and the NOT FOR OPERATIONAL USE watermark (rule #8) stays
 * until validation completes.
 */

// ---------------------------------------------------------------------------
// Measured geometry (pt). L = left edge, R = right edge, T = top, H = height.
// ---------------------------------------------------------------------------

const PAGE_L = 11.6;
const PAGE_R = 583.7;

const BAND1 = { top: 11.6, labelH: 10, height: 35.5 };
/** x boundaries: logo | title | CHECKED | APPROVED | EDNO */
const BAND1_X = [11.9, 104.4, 302.1, 395.7, 489.6, 583.5];

const BAND2 = { top: 50.4, labelH: 8.9, height: 27.7 };
/** FROM/TO | FLIGHT | A/C REG | VERSION | CREW | DATE | TIME */
const BAND2_X = [11.9, 105.5, 199.4, 293.3, 325.4, 419.0, 499.3, 583.5];

const TTL_ROW_Y = 87.5;

const GRID = {
  titleY: 102.5,
  titleRuleY: 109.1,
  firstRowY: 110.5,
  rowPitch: 15,
  boxH: 13.3,
  codeW: 21.6,
  weightW: 36,
  gap: 1.9,
  pairPitch: 63.2,
  mainX: 83.6,
  lowerX: 326.0,
  columns: 3,
  /** The reference always prints a full block of boxes, loaded or not,
   * so the sheet looks the same on a light flight as on a full one. */
  minRows: 13,
};

/** The weight rows under the grid, in the reference's own order. */
const BODY_TOP = 376;
const BODY_PITCH = 18.6;

const BAL_HEADING_Y = 525.6;
const BAL_TOP = 540.6;
const BAL_PITCH = 19.2;

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", color: "#000000" },
  root: { position: "relative", width: 595.28, height: 841.89 },

  box: { position: "absolute", borderStyle: "solid", borderColor: "#000000" },
  cellBox: {
    position: "absolute",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#9aa39c",
    borderRadius: 1,
  },

  label: { position: "absolute", fontSize: 6.5, fontWeight: 700 },
  value: { position: "absolute", fontSize: 8 },
  valueBold: { position: "absolute", fontSize: 8, fontWeight: 700 },
  micro: { position: "absolute", fontSize: 6 },
  cellText: { position: "absolute", fontSize: 6.5, textAlign: "center" },

  title: { position: "absolute", fontSize: 11.5, fontWeight: 700, letterSpacing: 2.2 },
  subtitle: { position: "absolute", fontSize: 5.6, letterSpacing: 0.6 },
  brandName: { position: "absolute", fontSize: 7.5, fontWeight: 700, color: "#0f7a3d" },

  rule: { position: "absolute", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#000000" },
  hairline: {
    position: "absolute",
    borderBottomWidth: 0.7,
    borderBottomStyle: "dotted",
    borderBottomColor: "#b8b8b8",
  },
  sectionRule: {
    position: "absolute",
    borderBottomWidth: 0.7,
    borderBottomStyle: "solid",
    borderBottomColor: "#cccccc",
  },
});

function At({
  x,
  y,
  children,
  variant = "value",
  width,
  align,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  variant?: "label" | "value" | "valueBold" | "micro" | "cellText";
  width?: number;
  align?: "center" | "right" | "left";
}) {
  const base =
    variant === "label"
      ? styles.label
      : variant === "valueBold"
        ? styles.valueBold
        : variant === "micro"
          ? styles.micro
          : variant === "cellText"
            ? styles.cellText
            : styles.value;
  return (
    <Text style={[base, { left: x, top: y }, width ? { width } : {}, align ? { textAlign: align } : {}]}>
      {children}
    </Text>
  );
}

function Rule({ x, y, w, weight = 1, color = "#000000" }: { x: number; y: number; w: number; weight?: number; color?: string }) {
  return (
    <View
      style={[
        styles.rule,
        { left: x, top: y, width: w, borderBottomWidth: weight, borderBottomColor: color },
      ]}
    />
  );
}

function Box({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <View style={[styles.box, { left: x, top: y, width: w, height: h, borderWidth: 1 }]} />;
}

// ---------------------------------------------------------------------------
// Weight distribution grid
// ---------------------------------------------------------------------------

interface DistributionRow {
  left: DocumentDeckCell | null;
  centre: DocumentDeckCell | null;
  right: DocumentDeckCell | null;
}

/**
 * The reference prints one grid per deck: left-side positions, centre
 * positions, right-side positions, fore to aft. Our plate data already
 * carries that — side-by-side configurations name their cells `…L`/`…R`,
 * every other configuration is a centre row — so the grid is derived, not
 * a second hand-maintained layout.
 */
function buildDistribution(rows: DocumentDeckRow[]): DistributionRow[] {
  const paired = new Map<string, { left: DocumentDeckCell | null; right: DocumentDeckCell | null }>();
  const centre: DocumentDeckCell[] = [];

  for (const row of rows) {
    for (const cell of row.cells) {
      const side = cell.code.endsWith("L") ? "left" : cell.code.endsWith("R") ? "right" : null;
      const base = side ? cell.code.slice(0, -1) : cell.code;
      if (side && base.length > 0) {
        const entry = paired.get(base) ?? { left: null, right: null };
        // A position can appear on more than one mutually exclusive
        // configuration row; the loaded one wins, so the grid shows the
        // weight rather than an empty box.
        if (entry[side] === null || entry[side]?.weight === null) entry[side] = cell;
        paired.set(base, entry);
      } else {
        centre.push(cell);
      }
    }
  }

  const pairs = [...paired.values()];
  const count = Math.max(pairs.length, centre.length);
  return Array.from({ length: count }, (_, i) => ({
    left: pairs[i]?.left ?? null,
    centre: centre[i] ?? null,
    right: pairs[i]?.right ?? null,
  }));
}

function GridCell({ cell, x, y }: { cell: DocumentDeckCell | null; x: number; y: number }) {
  const loaded = cell !== null && cell.weight !== null;
  return (
    <>
      <View style={[styles.cellBox, { left: x, top: y, width: GRID.codeW, height: GRID.boxH }]} />
      <View
        style={[
          styles.cellBox,
          { left: x + GRID.codeW + GRID.gap, top: y, width: GRID.weightW, height: GRID.boxH },
        ]}
      />
      {loaded ? (
        <>
          <At x={x} y={y + 4} width={GRID.codeW} align="center" variant="cellText">
            {cell.code}
          </At>
          <At
            x={x + GRID.codeW + GRID.gap}
            y={y + 4}
            width={GRID.weightW}
            align="center"
            variant="cellText"
          >
            {cell.weight}
          </At>
        </>
      ) : null}
    </>
  );
}

function DeckGrid({ rows, originX, count }: { rows: DistributionRow[]; originX: number; count: number }) {
  const padded: DistributionRow[] = Array.from(
    { length: count },
    (_, i) => rows[i] ?? { left: null, centre: null, right: null },
  );
  return (
    <>
      {padded.map((row, i) => {
        const y = GRID.firstRowY + i * GRID.rowPitch;
        return (
          <View key={i} style={{ position: "absolute", left: 0, top: 0, width: 595.28 }}>
            <GridCell cell={row.left} x={originX} y={y} />
            <GridCell cell={row.centre} x={originX + GRID.pairPitch} y={y} />
            <GridCell cell={row.right} x={originX + GRID.pairPitch * 2} y={y} />
          </View>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------

function WeightRow({
  index,
  label,
  value,
  max,
  extra,
}: {
  index: number;
  label: string;
  value: string;
  max?: string;
  extra?: string;
}) {
  const y = BODY_TOP + index * BODY_PITCH;
  return (
    <>
      <At x={PAGE_L} y={y} variant="label">
        {label}
      </At>
      <At x={157} y={y - 0.8}>
        {value}
      </At>
      {max ? (
        <>
          <At x={253} y={y - 0.8} variant="micro">
            MAX
          </At>
          <At x={270} y={y - 0.8}>
            {max}
          </At>
          <At x={351} y={y - 0.8} variant="micro">
            ADJ
          </At>
        </>
      ) : null}
      {extra ? (
        <At x={251} y={y - 0.8} variant="micro">
          {extra}
        </At>
      ) : null}
      <View style={[styles.hairline, { left: PAGE_L, top: y + 11.5, width: PAGE_R - PAGE_L }]} />
    </>
  );
}

function BalanceRow({
  index,
  label,
  value,
  secondLabel,
  secondValue,
}: {
  index: number;
  label: string;
  value: string;
  secondLabel?: string;
  secondValue?: string;
}) {
  const y = BAL_TOP + index * BAL_PITCH;
  return (
    <>
      <At x={PAGE_L} y={y} variant="micro">
        {label}
      </At>
      <At x={86} y={y - 1} variant="micro">
        {value}
      </At>
      {secondLabel ? (
        <>
          <At x={125} y={y} variant="micro">
            {secondLabel}
          </At>
          <At x={187} y={y - 1} variant="micro">
            {secondValue}
          </At>
        </>
      ) : null}
    </>
  );
}

function LoadsheetDocument({ input }: { input: LoadsheetInput }) {
  const main = buildDistribution(input.layout.main);
  const lower = buildDistribution(input.layout.lower);
  const gridRows = Math.max(main.length, lower.length, GRID.minRows);
  const gridBottom = GRID.firstRowY + gridRows * GRID.rowPitch;

  const loaded = input.ulds;

  return (
    // Fixed creationDate/modificationDate — see lir-document.tsx's identical
    // comment. Determinism applies to document *content*, not render time.
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.root}>
          <Watermark show={input.watermark} />

          {/* ---------------- Header band 1 ---------------- */}
          <Box x={BAND1_X[0]!} y={BAND1.top} w={BAND1_X[5]! - BAND1_X[0]!} h={BAND1.height} />
          {BAND1_X.slice(1, 5).map((x) => (
            <View
              key={`b1-${x}`}
              style={{
                position: "absolute",
                left: x,
                top: BAND1.top,
                width: 1,
                height: BAND1.height,
                backgroundColor: "#000000",
              }}
            />
          ))}
          <Rule x={BAND1_X[2]!} y={BAND1.top + BAND1.labelH} w={BAND1_X[5]! - BAND1_X[2]!} />

          <View style={{ position: "absolute", left: BAND1_X[0]! + 10, top: BAND1.top + 6 }}>
            <AirlineLogo height={22} />
          </View>
          <At x={BAND1_X[1]! + 14} y={BAND1.top + 8}>
            <Text style={styles.title}>LOADSHEET</Text>
          </At>
          <Text style={[styles.subtitle, { left: BAND1_X[1]! + 15, top: BAND1.top + 23 }]}>
            ALL WEIGHTS IN KILOGRAM
          </Text>

          <At x={BAND1_X[2]!} y={BAND1.top + 2.5} width={BAND1_X[3]! - BAND1_X[2]!} align="center" variant="label">
            CHECKED
          </At>
          <At x={BAND1_X[3]!} y={BAND1.top + 2.5} width={BAND1_X[4]! - BAND1_X[3]!} align="center" variant="label">
            APPROVED
          </At>
          <At x={BAND1_X[4]!} y={BAND1.top + 2.5} width={BAND1_X[5]! - BAND1_X[4]!} align="center" variant="label">
            EDNO
          </At>
          <At x={BAND1_X[2]!} y={BAND1.top + 18} width={BAND1_X[3]! - BAND1_X[2]!} align="center">
            {input.header.preparedBy}
          </At>
          <At x={BAND1_X[3]!} y={BAND1.top + 18} width={BAND1_X[4]! - BAND1_X[3]!} align="center">
            {input.header.checkedBy}
          </At>
          <At x={BAND1_X[4]!} y={BAND1.top + 18} width={BAND1_X[5]! - BAND1_X[4]!} align="center">
            {input.header.editionNo}
          </At>

          {/* ---------------- Header band 2 ---------------- */}
          <Box x={BAND2_X[0]!} y={BAND2.top} w={BAND2_X[7]! - BAND2_X[0]!} h={BAND2.height} />
          {BAND2_X.slice(1, 7).map((x) => (
            <View
              key={`b2-${x}`}
              style={{
                position: "absolute",
                left: x,
                top: BAND2.top,
                width: 1,
                height: BAND2.height,
                backgroundColor: "#000000",
              }}
            />
          ))}
          <Rule x={BAND2_X[0]!} y={BAND2.top + BAND2.labelH} w={BAND2_X[7]! - BAND2_X[0]!} />

          {(
            [
              ["FROM / TO", `${input.header.station} / ${input.destination}`],
              ["FLIGHT", input.header.flightNo],
              ["A/C REG", input.header.registration],
              ["VERSION", input.version],
              ["CREW", `${input.cockpitCrew}/${input.courierCrew}`],
              ["DATE", input.header.date],
              ["TIME", input.time],
            ] as const
          ).map(([label, value], i) => {
            const x0 = BAND2_X[i]!;
            const w = BAND2_X[i + 1]! - x0;
            return (
              <View key={label} style={{ position: "absolute", left: 0, top: 0, width: 595.28 }}>
                <At x={x0} y={BAND2.top + 2} width={w} align="center" variant="label">
                  {label}
                </At>
                <At x={x0} y={BAND2.top + 13} width={w} align="center">
                  {value}
                </At>
              </View>
            );
          })}

          {/* ---------------- Weight distribution ---------------- */}
          <At x={PAGE_L} y={TTL_ROW_Y} variant="label">
            LOAD IN COMPARTMENTS
          </At>
          <At x={128} y={TTL_ROW_Y - 1}>
            {input.ttl}
          </At>

          <At
            x={GRID.mainX}
            y={GRID.titleY}
            width={GRID.pairPitch * GRID.columns - GRID.gap}
            align="center"
            variant="label"
          >
            MAIN DECK
          </At>
          <Rule x={GRID.mainX} y={GRID.titleRuleY} w={GRID.pairPitch * GRID.columns - GRID.gap} />
          <At
            x={GRID.lowerX}
            y={GRID.titleY}
            width={GRID.pairPitch * GRID.columns - GRID.gap}
            align="center"
            variant="label"
          >
            LOWER DECK
          </At>
          <Rule x={GRID.lowerX} y={GRID.titleRuleY} w={GRID.pairPitch * GRID.columns - GRID.gap} />

          <At x={274} y={GRID.titleY + 4} width={48} align="center" variant="label">
            WEIGHT
          </At>
          <Text style={[styles.label, { left: 271, top: GRID.titleY + 11, width: 54, textAlign: "center", fontSize: 5.6 }]}>
            DISTRIBUTION
          </Text>

          <DeckGrid rows={main} originX={GRID.mainX} count={gridRows} />
          <DeckGrid rows={lower} originX={GRID.lowerX} count={gridRows} />

          <View
            style={[
              styles.sectionRule,
              { left: PAGE_L, top: Math.max(gridBottom + 6, BODY_TOP - 12), width: PAGE_R - PAGE_L },
            ]}
          />

          {/* ---------------- Weights ---------------- */}
          <At x={PAGE_L} y={BODY_TOP} variant="label">
            PASSENGER / CABIN BAG
          </At>
          <At x={155} y={BODY_TOP - 0.8}>
            {input.passengerCount}/
          </At>
          <At x={174} y={BODY_TOP - 0.8}>
            {input.passengerCount}/
          </At>
          <At x={196} y={BODY_TOP - 0.8}>
            {input.passengerCount}
          </At>
          <At x={222} y={BODY_TOP - 0.8} variant="micro">
            TTL {input.passengerCount}
          </At>
          <At x={288} y={BODY_TOP - 0.8} variant="micro">
            CAB {input.cabinBagWeight}
          </At>
          <View style={[styles.hairline, { left: PAGE_L, top: BODY_TOP + 11.5, width: PAGE_R - PAGE_L }]} />

          <WeightRow index={1} label="TOTAL TRAFFIC LOAD" value={input.ttl} extra="BLKD" />
          <WeightRow index={2} label="DRY OPERATING WEIGHT" value={input.dow} />
          <WeightRow index={3} label="ZERO FUEL WEIGHT ACTUAL" value={input.zfw} max={input.mzfw} />
          <WeightRow index={4} label="TAKE OFF FUEL" value={input.takeoffFuel} />
          <WeightRow index={5} label="TAKE OFF WEIGHT ACTUAL" value={input.tow} max={input.mtow} />
          <WeightRow index={6} label="TRIP FUEL" value={input.tripFuel} />
          <WeightRow index={7} label="LANDING WEIGHT ACTUAL" value={input.ldw} max={input.mlw} />

          {/* ---------------- Balance ---------------- */}
          <At x={PAGE_L} y={BAL_HEADING_Y} variant="label">
            BALANCE AND SEATING CONDITIONS
          </At>
          <Rule x={PAGE_L} y={BAL_HEADING_Y + 8} w={135} weight={0.7} />
          <At x={227} y={BAL_HEADING_Y} variant="label">
            LAST MINUTE CHANGES
          </At>
          <Rule x={227} y={BAL_HEADING_Y + 8} w={88} weight={0.7} />

          <BalanceRow index={0} label="FUEL DENSITY" value={input.fuelDensity} />
          <BalanceRow index={1} label="DOI" value={input.doi} />
          <BalanceRow index={2} label="LIZFW" value={input.lizfw} secondLabel="MACZFW" secondValue={input.maczfw} />
          <BalanceRow index={3} label="LITOW" value={input.litow} secondLabel="MACTOW" secondValue={input.mactow} />
          <BalanceRow
            index={4}
            label="TRIM SETTING"
            value={`${input.stab.value} ${input.stab.direction}`}
          />

          {input.lastMinuteChanges.length === 0 ? (
            <At x={227} y={BAL_TOP} variant="micro">
              NIL
            </At>
          ) : (
            input.lastMinuteChanges.map((lmc, i) => (
              <At key={lmc.position} x={227} y={BAL_TOP + i * 11} variant="micro">
                {lmc.position} {lmc.weightDelta} {lmc.description ?? ""}
              </At>
            ))
          )}

          <View style={[styles.sectionRule, { left: PAGE_L, top: 630, width: PAGE_R - PAGE_L }]} />

          <At x={PAGE_L} y={636} variant="micro">
            UNDERLOAD BEFORE LMC
          </At>
          <At x={116} y={635} variant="micro">
            {input.underloadBeforeLmc}
          </At>
          <At x={154} y={636} variant="micro">
            LMC TOTAL
          </At>

          <At x={PAGE_L} y={652} variant="micro">
            TAXI FUEL
          </At>
          <At x={67} y={651} variant="micro">
            {input.taxiFuel}
          </At>
          <At x={102} y={652} variant="micro">
            TAXI WEIGHT
          </At>
          <At x={158} y={651} variant="micro">
            {input.taxiWeight}
          </At>
          <At x={202} y={652} variant="micro">
            MAX
          </At>
          <At x={222} y={651} variant="micro">
            {input.mtw}
          </At>
          <At x={253} y={652} variant="micro">
            ADJ
          </At>

          <At x={PAGE_L} y={664} variant="micro">
            A/C TYPE: {input.header.aircraftType}
          </At>
          <At x={PAGE_L} y={672} variant="micro">
            CAPTAIN INFORMATION / NOTES
          </At>
          {/* The two fields AHM 560 requires and the reference omits
              (Bulgu #2, #5), printed inside the reference's own notes area
              rather than as new furniture. */}
          <At x={150} y={672} variant="micro">
            LILAW {input.lilaw} · MACLAW {input.maclaw} · AHM 560 ED {input.ahmEdition} REV {input.ahmRevision}
          </At>
          {/* A compartment over its AHM limit is printed here, in red, on
              the sheet itself. The reference has no compartment block at
              all; leaving an exceedance off the document because the
              reference does not show it would hide a safety fact, so it
              goes in the notes area the reference does have. Nothing is
              printed when every compartment is inside its limit, which is
              the normal case — the layout then matches the reference
              exactly. */}
          {input.compartments
            .filter((compartment) => !compartment.withinLimit)
            .map((compartment, i) => (
              <Text
                key={compartment.target}
                style={[
                  styles.micro,
                  { left: 150, top: 680 + i * 8, color: "#cc0000", fontWeight: 700 },
                ]}
              >
                COMPARTMENT LIMIT EXCEEDED: {compartment.target.toUpperCase()} {compartment.actual} /{" "}
                {compartment.max}
              </Text>
            ))}

          <At x={PAGE_L} y={684} variant="micro">
            ZFW (corrected)
          </At>
          <At x={91} y={683} variant="micro">
            {input.zfw}
          </At>
          <At x={PAGE_L} y={699} variant="micro">
            ZFI (corrected)
          </At>
          <At x={95} y={698} variant="micro">
            {input.lizfw}
          </At>
          <At x={PAGE_L} y={711} variant="label">
            {input.refuelMode} REFUELING
          </At>

          {(
            [
              ["FWD/AFT ZFW LIMITS: INDEX", input.zfwForwardLimit, input.zfwAftLimit],
              ["FWD/AFT ZFW (corr.) LIMITS: INDEX", input.zfwForwardLimit, input.zfwAftLimit],
              ["FWD/AFT TOW LIMITS: INDEX", input.towForwardLimit, input.towAftLimit],
            ] as const
          ).map(([label, fwd, aft], i) => {
            const y = 723 + i * 15.2;
            return (
              <View key={label} style={{ position: "absolute", left: 0, top: 0, width: 595.28 }}>
                <At x={PAGE_L} y={y} variant="micro">
                  {label}
                </At>
                <At x={145} y={y - 1} variant="micro">
                  {fwd}
                </At>
                <At x={177} y={y} variant="micro">
                  /
                </At>
                <At x={196} y={y - 1} variant="micro">
                  {aft}
                </At>
              </View>
            );
          })}

          <View style={[styles.sectionRule, { left: PAGE_L, top: 765, width: PAGE_R - PAGE_L }]} />

          <At x={22} y={771} variant="micro">
            {input.header.flightNo} / {input.header.date} {input.header.registration} {input.version} OC{" "}
            {input.cockpitCrew}/{input.courierCrew}
          </At>
          <At x={19} y={786} variant="micro">
            {input.destination}
          </At>
          <View
            style={{
              position: "absolute",
              left: 50,
              top: 782,
              width: PAGE_R - 60,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {loaded.map((uld) => (
              <Text
                key={uld.position}
                style={{
                  fontSize: 6,
                  backgroundColor: "#eeeeee",
                  paddingHorizontal: 3,
                  paddingVertical: 1.5,
                  marginRight: 4,
                  marginBottom: 2,
                }}
              >
                {uld.position} {uld.grossWeight}
              </Text>
            ))}
          </View>

          <At x={PAGE_L} y={815} variant="micro">
            SI :
          </At>
          <View
            style={[
              styles.box,
              { left: 30, top: 806, width: PAGE_R - 30, height: 26, borderWidth: 1, borderColor: "#666666" },
            ]}
          />
          <At x={34} y={812} variant="micro">
            {input.specialInformation}
          </At>
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
