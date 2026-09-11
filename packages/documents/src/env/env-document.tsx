import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  G,
  Line,
  Polyline,
  Circle,
  Rect,
  renderToBuffer,
} from "@react-pdf/renderer";
import { chrome, Watermark } from "../shared/chrome";
import { AirlineLogo } from "../shared/logo";
import { COLOR, FONT, RULE } from "../shared/tokens";
import type { EnvCgPoint, EnvInput, EnvPlottedPoint } from "./types";

/**
 * CG ENVELOPE.
 *
 * Laid out to match the sheet the crew already reads: a boxed header table
 * (station / flight / date / aircraft / signatures / edition), the document
 * title, a boxed legend, then the chart in its own frame. The rest of our
 * documents use the shared `DocumentBand`; this one does not, because the
 * envelope is the page the crew compares against the previous provider's
 * print most often and a matching layout is what makes that comparison
 * quick.
 *
 * Two deliberate differences from that reference sheet:
 *
 * - Its own header table overflows the page and clips the ED NO column
 *   (Bulgu #6). Ours is a flex row, so the last column always fits.
 * - The NOT FOR OPERATIONAL USE watermark stays until validation completes
 *   (CLAUDE.md rule #8), and an out-of-envelope point still prints its
 *   warning band. Neither appears on the reference sheet.
 */

/** Chart frame and plot box, in PDF points. Pure layout: every data bound
 * comes from `input.extent` (@tua/wnb-core), so no axis value is fixed here
 * and no curve can fall off the chart when a revision moves a breakpoint. */
const FRAME = { w: 392, h: 344 } as const;

/** Type sizes for this sheet only. The rest of our documents take them from
 * `FONT`; the envelope is set a little larger because it is read at arm's
 * length next to the chart, and because it mirrors the sheet the crew
 * already compares it against. */
const ENV_FONT = { headerLabel: 8, headerValue: 9, title: 10.5, legend: 7.5, tick: 6.8 } as const;

/** The chart grid is an aid to reading a point off the axes, not content.
 * `COLOR.grid` (used by the dense position tables) is too strong here — it
 * competed with the limit curves — so the envelope uses a lighter rule. */
const GRID_COLOR = "#e8e8e8";
const PLOT = { x: 40, y: 14, w: 330, h: 292 } as const;

function scaler(extent: EnvInput["extent"]) {
  const indexMin = Number(extent.indexMin);
  const indexMax = Number(extent.indexMax);
  const weightMin = Number(extent.weightMin);
  const weightMax = Number(extent.weightMax);

  return {
    x: (index: number) => PLOT.x + ((index - indexMin) / (indexMax - indexMin)) * PLOT.w,
    y: (weight: number) => PLOT.y + PLOT.h - ((weight - weightMin) / (weightMax - weightMin)) * PLOT.h,
  };
}

/** The reference marks take-off CG with an eight-armed asterisk rather than
 * a filled star; drawn as strokes so it reads the same at print size. */
function asteriskArms(cx: number, cy: number, r: number): [number, number, number, number][] {
  return Array.from({ length: 4 }, (_, i) => {
    const angle = (Math.PI / 4) * i;
    const dx = r * Math.cos(angle);
    const dy = r * Math.sin(angle);
    return [cx - dx, cy - dy, cx + dx, cy + dy] as [number, number, number, number];
  });
}

const styles = StyleSheet.create({
  headerTable: {
    flexDirection: "row",
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.ink,
  },
  logoCell: {
    flex: 102,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  headerFields: { flex: 543, flexDirection: "column" },
  headerRow: { flexDirection: "row" },
  headerLabelRow: { backgroundColor: COLOR.fill },
  headerDivider: { borderTopWidth: RULE.hairline, borderTopStyle: "solid", borderTopColor: COLOR.ink },
  headerCell: {
    borderLeftWidth: RULE.hairline,
    borderLeftStyle: "solid",
    borderLeftColor: COLOR.ink,
    paddingVertical: 3,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  headerLabel: { fontSize: ENV_FONT.headerLabel, fontWeight: 700, textAlign: "center" },
  headerValue: { fontSize: ENV_FONT.headerValue, textAlign: "center" },

  title: {
    fontSize: ENV_FONT.title,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 1.1,
    marginTop: 9,
    marginBottom: 7,
  },
  titleRule: { borderTopWidth: RULE.hairline, borderTopStyle: "solid", borderTopColor: COLOR.ink },

  legend: {
    marginTop: 6,
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.grid,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendLabel: { fontSize: ENV_FONT.legend },

  chartWrap: { marginTop: 14, alignItems: "center" },
  chartFrame: {
    borderWidth: 1.2,
    borderStyle: "solid",
    borderColor: COLOR.ink,
    padding: 6,
  },

  warningBox: {
    marginTop: 6,
    borderWidth: RULE.hairline,
    borderStyle: "solid",
    borderColor: COLOR.danger,
    backgroundColor: COLOR.dangerFill,
    padding: 5,
  },
  warningText: { fontSize: FONT.label, fontWeight: 700, color: COLOR.danger },
});

type Scale = ReturnType<typeof scaler>;

/** Station / flight / date / aircraft / signatures / edition, boxed. */
function HeaderTable({ header }: { header: EnvInput["header"] }) {
  const columns: { label: string; value: string; flex: number }[] = [
    { label: "STATION", value: header.station, flex: 64 },
    { label: "FLIGHT", value: header.flightNo, flex: 62 },
    { label: "DATE", value: header.date, flex: 83 },
    { label: "A/C", value: header.registration, flex: 64 },
    { label: "Prepared by", value: header.preparedBy, flex: 66 },
    { label: "Approved by", value: header.checkedBy, flex: 66 },
    { label: "ED NO", value: header.editionNo, flex: 38 },
  ];

  return (
    <View style={styles.headerTable}>
      <View style={styles.logoCell}>
        <AirlineLogo height={26} />
      </View>
      <View style={styles.headerFields}>
        <View style={[styles.headerRow, styles.headerLabelRow]}>
          {columns.map((column) => (
            <View key={column.label} style={[styles.headerCell, { flex: column.flex }]}>
              <Text style={styles.headerLabel}>{column.label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.headerRow, styles.headerDivider]}>
          {columns.map((column) => (
            <View key={column.label} style={[styles.headerCell, { flex: column.flex }]}>
              <Text style={styles.headerValue}>{column.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * One limit curve, drawn closed.
 *
 * AHM 560 publishes a forward and an aft breakpoint list; the envelope they
 * describe is the area between them, bounded at the table's lowest and
 * highest weight. Forward is walked up, aft is walked back down, and the
 * outline is closed. No breakpoint is invented: the closing segments join
 * existing endpoints at the same weight.
 */
function CurveOutline({
  curve,
  color,
  dashed,
  scale,
}: {
  curve: { forward: EnvCgPoint[]; aft: EnvCgPoint[] };
  color: string;
  dashed?: boolean;
  scale: Scale;
}) {
  const byWeight = (points: EnvCgPoint[]) => [...points].sort((a, b) => Number(a.weight) - Number(b.weight));
  const forward = byWeight(curve.forward);
  const aft = byWeight(curve.aft).reverse();
  const outline = [...forward, ...aft, forward[0]].filter((p): p is EnvCgPoint => Boolean(p));
  if (outline.length < 3) return null;

  const coords = outline.map((p) => `${scale.x(Number(p.index))},${scale.y(Number(p.weight))}`).join(" ");
  return (
    <Polyline
      points={coords}
      stroke={color}
      strokeWidth={1.2}
      fill="none"
      strokeDasharray={dashed ? "5,3" : undefined}
    />
  );
}

function PointMarker({
  point,
  shape,
  color,
  scale,
}: {
  point: EnvPlottedPoint;
  shape: "circle" | "asterisk" | "square";
  color: string;
  scale: Scale;
}) {
  const cx = scale.x(Number(point.index));
  const cy = scale.y(Number(point.weight));
  // An out-of-envelope point is printed in the danger colour whatever its
  // legend colour: the reader must not have to compare coordinates to see it.
  const markColor = point.withinEnvelope ? color : COLOR.danger;

  if (shape === "circle") return <Circle cx={cx} cy={cy} r={3.4} fill={markColor} />;
  if (shape === "square") return <Rect x={cx - 3} y={cy - 3} width={6} height={6} fill={markColor} />;
  return (
    <G>
      {asteriskArms(cx, cy, 4.6).map(([x1, y1, x2, y2]) => (
        <Line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={markColor} strokeWidth={1.3} />
      ))}
    </G>
  );
}

function LegendSwatch({ shape, color }: { shape: LegendShape; color: string }) {
  if (shape === "line" || shape === "dashed-line") {
    return (
      <Svg width={22} height={8}>
        <Line
          x1={0}
          y1={4}
          x2={22}
          y2={4}
          stroke={color}
          strokeWidth={1.4}
          strokeDasharray={shape === "dashed-line" ? "5,3" : undefined}
        />
      </Svg>
    );
  }
  return (
    <Svg width={10} height={10}>
      {shape === "circle" ? <Circle cx={5} cy={5} r={3.4} fill={color} /> : null}
      {shape === "square" ? <Rect x={1.6} y={1.6} width={6.8} height={6.8} fill={color} /> : null}
      {shape === "asterisk" ? (
        <G>
          {asteriskArms(5, 5, 4.4).map(([x1, y1, x2, y2]) => (
            <Line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.3} />
          ))}
        </G>
      ) : null}
    </Svg>
  );
}

type LegendShape = "line" | "dashed-line" | "circle" | "asterisk" | "square";

/** Seven entries on two centred rows, as the crew's sheet prints them. The
 * corrected-ZFCG entry is always listed, so the key reads the same whether
 * or not this flight had an LMC. */
function Legend() {
  const rows: { shape: LegendShape; color: string; label: string }[][] = [
    [
      { shape: "dashed-line", color: COLOR.takeoff, label: "Take off limits" },
      { shape: "line", color: COLOR.forward, label: "Zero fuel limits" },
      { shape: "line", color: COLOR.danger, label: "Landing limits" },
      { shape: "line", color: COLOR.ink, label: "Min. weight limit" },
      { shape: "circle", color: COLOR.forward, label: "Zero fuel CG" },
      { shape: "asterisk", color: COLOR.takeoff, label: "Take off CG" },
    ],
    [{ shape: "square", color: COLOR.corrected, label: "Zero fuel CG (corrected)" }],
  ];

  return (
    <View style={styles.legend}>
      {rows.map((row, i) => (
        <View key={row[0]!.label} style={[styles.legendRow, i > 0 ? { marginTop: 3 } : {}]}>
          {row.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <LegendSwatch shape={item.shape} color={item.color} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Index of a breakpoint list at `weight`, linearly interpolated between the
 * two breakpoints that bracket it — the same reading the limit check makes.
 * Clamped to the list's own ends: a weight outside the published table has no
 * interpolated value, and extrapolating one would invent a limit. */
function indexAtWeight(points: EnvCgPoint[], weight: number): number {
  const sorted = [...points].sort((a, b) => Number(a.weight) - Number(b.weight));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (weight <= Number(first.weight)) return Number(first.index);
  if (weight >= Number(last.weight)) return Number(last.index);

  for (let i = 1; i < sorted.length; i++) {
    const low = sorted[i - 1]!;
    const high = sorted[i]!;
    if (weight > Number(high.weight)) continue;
    const span = Number(high.weight) - Number(low.weight);
    const ratio = span === 0 ? 0 : (weight - Number(low.weight)) / span;
    return Number(low.index) + ratio * (Number(high.index) - Number(low.index));
  }
  return Number(last.index);
}

function Chart({ input, scale }: { input: EnvInput; scale: Scale }) {
  const bottom = PLOT.y + PLOT.h;
  const right = PLOT.x + PLOT.w;
  const mlwSpan = {
    forward: indexAtWeight(input.takeoffLimits.forward, Number(input.mlw)),
    aft: indexAtWeight(input.takeoffLimits.aft, Number(input.mlw)),
  };

  return (
    <Svg width={FRAME.w} height={FRAME.h}>
      {/* Grid first, so limits and points draw over it. */}
      {input.extent.indexTicks.map((tick) => (
        <Line
          key={`xg-${tick}`}
          x1={scale.x(Number(tick))}
          y1={PLOT.y}
          x2={scale.x(Number(tick))}
          y2={bottom}
          stroke={GRID_COLOR}
          strokeWidth={0.35}
        />
      ))}
      {input.extent.weightTicks.map((tick) => (
        <Line
          key={`yg-${tick}`}
          x1={PLOT.x}
          y1={scale.y(Number(tick))}
          x2={right}
          y2={scale.y(Number(tick))}
          stroke={GRID_COLOR}
          strokeWidth={0.35}
        />
      ))}

      <Line x1={PLOT.x} y1={PLOT.y} x2={PLOT.x} y2={bottom} stroke={COLOR.ink} strokeWidth={0.8} />
      <Line x1={PLOT.x} y1={bottom} x2={right} y2={bottom} stroke={COLOR.ink} strokeWidth={0.8} />

      {input.extent.indexTicks.map((tick) => (
        <G key={`xt-${tick}`}>
          <Line
            x1={scale.x(Number(tick))}
            y1={bottom}
            x2={scale.x(Number(tick))}
            y2={bottom + 3}
            stroke={COLOR.ink}
            strokeWidth={0.8}
          />
          <Text x={scale.x(Number(tick)) - 6} y={bottom + 13} style={{ fontSize: ENV_FONT.tick }}>
            {tick}
          </Text>
        </G>
      ))}
      {input.extent.weightTicks.map((tick) => (
        <G key={`yt-${tick}`}>
          <Line
            x1={PLOT.x - 3}
            y1={scale.y(Number(tick))}
            x2={PLOT.x}
            y2={scale.y(Number(tick))}
            stroke={COLOR.ink}
            strokeWidth={0.8}
          />
          <Text x={PLOT.x - 32} y={scale.y(Number(tick)) + 2.5} style={{ fontSize: ENV_FONT.tick }}>
            {`${(Number(tick) / 1000).toFixed(0)}k`}
          </Text>
        </G>
      ))}

      <CurveOutline curve={input.takeoffLimits} color={COLOR.takeoff} dashed scale={scale} />
      <CurveOutline curve={input.zfwLimits} color={COLOR.forward} scale={scale} />

      {/* No landing CG table is published (GROUND_TRUTH §21 Q3), so MLW is a
          weight-axis reference rather than an index-bounded curve. It is drawn
          across the take-off envelope only: outside that envelope there is no
          usable configuration for the line to say anything about. */}
      <Line
        x1={scale.x(mlwSpan.forward)}
        y1={scale.y(Number(input.mlw))}
        x2={scale.x(mlwSpan.aft)}
        y2={scale.y(Number(input.mlw))}
        stroke={COLOR.danger}
        strokeWidth={1.2}
      />
      <Line
        x1={PLOT.x}
        y1={scale.y(Number(input.minWeight))}
        x2={right}
        y2={scale.y(Number(input.minWeight))}
        stroke={COLOR.ink}
        strokeWidth={1}
      />

      <PointMarker point={input.zfcg} shape="circle" color={COLOR.forward} scale={scale} />
      <PointMarker point={input.tocg} shape="asterisk" color={COLOR.takeoff} scale={scale} />
      {input.zfcgCorrected ? (
        <PointMarker point={input.zfcgCorrected} shape="square" color={COLOR.corrected} scale={scale} />
      ) : null}
    </Svg>
  );
}

function EnvDocument({ input }: { input: EnvInput }) {
  // Passed down explicitly rather than held in module state: two ENV renders
  // can be in flight at once (the documents page generates in parallel), and
  // a shared binding would let one flight's extent draw another's curves.
  const scale = scaler(input.extent);

  const outOfEnvelopePoints: string[] = [];
  if (!input.zfcg.withinEnvelope) outOfEnvelopePoints.push("ZFCG");
  if (!input.tocg.withinEnvelope) outOfEnvelopePoints.push("TOCG");
  if (input.zfcgCorrected && !input.zfcgCorrected.withinEnvelope) outOfEnvelopePoints.push("ZFCG (CORRECTED)");

  return (
    // Fixed creationDate/modificationDate — see lir-document.tsx's identical
    // comment. Determinism applies to document *content*, not render time.
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={chrome.page}>
        <Watermark show={input.watermark} />

        <HeaderTable header={input.header} />

        <Text style={styles.title}>{`CG ENVELOPE — ${input.header.aircraftType.toUpperCase()}`}</Text>
        <View style={styles.titleRule} />

        {outOfEnvelopePoints.length > 0 ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {`OUT OF ENVELOPE: ${outOfEnvelopePoints.join(", ")} — do not use this configuration until corrected.`}
            </Text>
          </View>
        ) : null}

        <Legend />

        <View style={styles.chartWrap}>
          <View style={styles.chartFrame}>
            <Chart input={input} scale={scale} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Deterministic — identical `input` always renders identical bytes (no
 * wall-clock timestamp anywhere in the document), per CLAUDE.md's
 * "aynı girdi → byte-identical çıktı" requirement for safety documents. */
export async function renderEnvPdf(input: EnvInput): Promise<Buffer> {
  return renderToBuffer(<EnvDocument input={input} />);
}
