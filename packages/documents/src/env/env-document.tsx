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
  Polygon,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { EnvCgPoint, EnvInput, EnvPlottedPoint } from "./types";

// Chart-scale bounds — a presentation choice (how much of the index/weight
// plane to draw), not an AHM 560 data value, so it isn't sourced from
// cg-limits.json (CLAUDE.md rule #3 concerns AHM *limits*, not the axis
// zoom level chosen to keep those limits legible). Matches the plan spec's
// own fixed range (docs/IMPLEMENTATION_PLAN.md Faz 11).
const INDEX_MIN = 40;
const INDEX_MAX = 200;
const WEIGHT_MIN = 110000;
const WEIGHT_MAX = 240000;

const CHART_X = 60;
const CHART_Y = 20;
const CHART_W = 460;
const CHART_H = 380;

function xForIndex(index: number): number {
  return CHART_X + ((index - INDEX_MIN) / (INDEX_MAX - INDEX_MIN)) * CHART_W;
}
function yForWeight(weight: number): number {
  return CHART_Y + CHART_H - ((weight - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)) * CHART_H;
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 4,
    columnGap: 4,
    marginBottom: 10,
    borderTop: 1,
    borderColor: "#999999",
    paddingTop: 6,
  },
  headerField: { width: "23%", flexDirection: "column" },
  headerLabel: { fontSize: 6.5, color: "#555555" },
  headerValue: { fontSize: 8.5, fontWeight: 700 },
  chartWrap: { alignItems: "center" },
  warningBox: {
    marginTop: 6,
    marginBottom: 6,
    border: 1,
    borderColor: "#cc0000",
    backgroundColor: "#fdeaea",
    padding: 6,
  },
  warningText: { fontSize: 9, fontWeight: 700, color: "#cc0000" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendLabel: { fontSize: 7 },
  siBox: { marginTop: 10, border: 1, borderColor: "#999999", padding: 6, minHeight: 30 },
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

function CurveLine({ points, color, dashed }: { points: EnvCgPoint[]; color: string; dashed?: boolean }) {
  const sorted = [...points].sort((a, b) => Number(a.weight) - Number(b.weight));
  const coords = sorted.map((p) => `${xForIndex(Number(p.index))},${yForWeight(Number(p.weight))}`).join(" ");
  return (
    <Polyline
      points={coords}
      stroke={color}
      strokeWidth={1.5}
      fill="none"
      strokeDasharray={dashed ? "4,3" : undefined}
    />
  );
}

function PointMarker({ point, shape, color }: { point: EnvPlottedPoint; shape: "circle" | "star" | "square"; color: string }) {
  const cx = xForIndex(Number(point.index));
  const cy = yForWeight(Number(point.weight));
  const markColor = point.withinEnvelope ? color : "#cc0000";

  if (shape === "circle") {
    return <Circle cx={cx} cy={cy} r={4} fill={markColor} />;
  }
  if (shape === "square") {
    return <Rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={markColor} />;
  }
  return <Polygon points={starPoints(cx, cy, 6, 2.6)} fill={markColor} />;
}

function LegendSwatch({ shape, color }: { shape: "line" | "dashed-line" | "circle" | "star" | "square" | "hline-red" | "hline-black"; color: string }) {
  if (shape === "line" || shape === "dashed-line" || shape === "hline-red" || shape === "hline-black") {
    return (
      <Svg width={16} height={8}>
        <Line
          x1={0}
          y1={4}
          x2={16}
          y2={4}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={shape === "dashed-line" ? "4,3" : undefined}
        />
      </Svg>
    );
  }
  return (
    <Svg width={10} height={10}>
      {shape === "circle" ? <Circle cx={5} cy={5} r={4} fill={color} /> : null}
      {shape === "square" ? <Rect x={1.5} y={1.5} width={7} height={7} fill={color} /> : null}
      {shape === "star" ? <Polygon points={starPoints(5, 5, 5, 2.2)} fill={color} /> : null}
    </Svg>
  );
}

function Legend({ hasCorrected }: { hasCorrected: boolean }) {
  const items: { shape: Parameters<typeof LegendSwatch>[0]["shape"]; color: string; label: string }[] = [
    { shape: "dashed-line", color: "#1d4ed8", label: "TAKE OFF LIMITS" },
    { shape: "line", color: "#15803d", label: "ZERO FUEL LIMITS" },
    { shape: "hline-red", color: "#cc0000", label: "LANDING LIMIT (MLW)" },
    { shape: "hline-black", color: "#111111", label: "MIN WEIGHT" },
    { shape: "circle", color: "#15803d", label: "ZERO FUEL CG" },
    { shape: "star", color: "#1d4ed8", label: "TAKE OFF CG" },
  ];
  if (hasCorrected) items.push({ shape: "square", color: "#7e22ce", label: "ZERO FUEL CG (CORRECTED)" });

  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <LegendSwatch shape={item.shape} color={item.color} />
          <Text style={styles.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function EnvDocument({ input }: { input: EnvInput }) {
  const outOfEnvelopePoints: string[] = [];
  if (!input.zfcg.withinEnvelope) outOfEnvelopePoints.push("ZFCG");
  if (!input.tocg.withinEnvelope) outOfEnvelopePoints.push("TOCG");
  if (input.zfcgCorrected && !input.zfcgCorrected.withinEnvelope) outOfEnvelopePoints.push("ZFCG (CORRECTED)");

  const xTicks: number[] = [];
  for (let i = INDEX_MIN; i <= INDEX_MAX; i += 20) xTicks.push(i);
  const yTicks: number[] = [];
  for (let w = WEIGHT_MIN; w <= WEIGHT_MAX; w += 20000) yTicks.push(w);

  return (
    // Fixed creationDate/modificationDate — see lir-document.tsx's identical
    // comment. Determinism applies to document *content*, not render time.
    <Document creationDate={new Date(0)} modificationDate={new Date(0)}>
      <Page size="A4" style={styles.page}>
        {input.watermark ? <Text style={styles.watermark}>NOT FOR OPERATIONAL USE</Text> : null}

        <Text style={styles.title}>CG ENVELOPE</Text>

        <View style={styles.headerGrid}>
          <HeaderField label="STATION" value={input.station} />
          <HeaderField label="FLIGHT" value={input.flightNo} />
          <HeaderField label="DATE" value={input.date} />
          <HeaderField label="A/C" value={`${input.registration} (${input.aircraftType})`} />
          <HeaderField label="PREPARED BY" value={input.preparedBy} />
          <HeaderField label="CHECKED BY" value={input.checkedBy} />
          <HeaderField label="ED NO" value={input.editionNo} />
        </View>

        {outOfEnvelopePoints.length > 0 ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              OUT OF ENVELOPE: {outOfEnvelopePoints.join(", ")} — do not use this configuration until corrected.
            </Text>
          </View>
        ) : null}

        <View style={styles.chartWrap}>
          <Svg width={CHART_X * 2 + CHART_W} height={CHART_Y + CHART_H + 40}>
            <Line x1={CHART_X} y1={CHART_Y} x2={CHART_X} y2={CHART_Y + CHART_H} stroke="#333333" strokeWidth={1} />
            <Line
              x1={CHART_X}
              y1={CHART_Y + CHART_H}
              x2={CHART_X + CHART_W}
              y2={CHART_Y + CHART_H}
              stroke="#333333"
              strokeWidth={1}
            />

            {xTicks.map((tick) => (
              <G key={`xt-${tick}`}>
                <Line
                  x1={xForIndex(tick)}
                  y1={CHART_Y + CHART_H}
                  x2={xForIndex(tick)}
                  y2={CHART_Y + CHART_H + 3}
                  stroke="#333333"
                  strokeWidth={1}
                />
                <Text x={xForIndex(tick) - 6} y={CHART_Y + CHART_H + 12} style={{ fontSize: 6 }}>
                  {tick}
                </Text>
              </G>
            ))}
            {yTicks.map((tick) => (
              <G key={`yt-${tick}`}>
                <Line
                  x1={CHART_X - 3}
                  y1={yForWeight(tick)}
                  x2={CHART_X}
                  y2={yForWeight(tick)}
                  stroke="#333333"
                  strokeWidth={1}
                />
                <Text x={CHART_X - 34} y={yForWeight(tick) + 2} style={{ fontSize: 6 }}>
                  {(tick / 1000).toFixed(0)}k
                </Text>
              </G>
            ))}
            <Text x={CHART_X + CHART_W / 2 - 10} y={CHART_Y + CHART_H + 24} style={{ fontSize: 7 }}>
              INDEX
            </Text>
            <Text x={CHART_X - 45} y={CHART_Y - 6} style={{ fontSize: 7 }}>
              WEIGHT (KG)
            </Text>

            <CurveLine points={input.takeoffLimits.forward} color="#1d4ed8" dashed />
            <CurveLine points={input.takeoffLimits.aft} color="#1d4ed8" dashed />
            <CurveLine points={input.zfwLimits.forward} color="#15803d" />
            <CurveLine points={input.zfwLimits.aft} color="#15803d" />

            <Line
              x1={CHART_X}
              y1={yForWeight(Number(input.mlw))}
              x2={CHART_X + CHART_W}
              y2={yForWeight(Number(input.mlw))}
              stroke="#cc0000"
              strokeWidth={1.5}
            />
            <Line
              x1={CHART_X}
              y1={yForWeight(Number(input.minWeight))}
              x2={CHART_X + CHART_W}
              y2={yForWeight(Number(input.minWeight))}
              stroke="#111111"
              strokeWidth={1}
            />

            <PointMarker point={input.zfcg} shape="circle" color="#15803d" />
            <PointMarker point={input.tocg} shape="star" color="#1d4ed8" />
            {input.zfcgCorrected ? <PointMarker point={input.zfcgCorrected} shape="square" color="#7e22ce" /> : null}
          </Svg>
        </View>

        <Legend hasCorrected={Boolean(input.zfcgCorrected)} />

        <View style={styles.siBox}>
          <Text style={styles.siLabel}>POINTS</Text>
          <Text>
            ZFCG: {input.zfcg.weight} kg / index {input.zfcg.index} — TOCG: {input.tocg.weight} kg / index{" "}
            {input.tocg.index}
            {input.zfcgCorrected
              ? ` — ZFCG (CORRECTED): ${input.zfcgCorrected.weight} kg / index ${input.zfcgCorrected.index}`
              : ""}
          </Text>
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
