/**
 * CG Envelope (ENV) — plain-data input shape. Every numeric limit comes
 * from the caller's `cg-limits.json`-sourced data (CLAUDE.md rule #3);
 * nothing here embeds an AHM breakpoint. The envelope math itself
 * (interpolation, in/out-of-envelope) is @tua/wnb-core's job — this
 * package only draws whatever `EnvelopeCheck`-shaped points it's given,
 * inside the extent @tua/wnb-core's `buildEnvelopeExtent()` computes for
 * both this document and the live chart on screen.
 */

import type { EnvelopeExtent } from "@tua/wnb-core";
import type { DocumentHeader } from "../shared/types";

export interface EnvCgPoint {
  weight: string;
  index: string;
}

export interface EnvCgCurve {
  forward: EnvCgPoint[];
  aft: EnvCgPoint[];
}

export interface EnvPlottedPoint {
  weight: string;
  index: string;
  withinEnvelope: boolean;
}

export interface EnvInput {
  header: DocumentHeader;

  zfwLimits: EnvCgCurve;
  takeoffLimits: EnvCgCurve;
  /** Horizontal red line — no separate landing CG table is published in AHM 560 (GROUND_TRUTH.md §21 Q3); the chart shows MLW as a weight-axis reference line, not an index-bounded curve. */
  mlw: string;
  /** Horizontal black line — minimum operating weight. */
  minWeight: string;

  /** Axis range and ticks, from @tua/wnb-core. Passing it in (rather than
   * deriving it here) is what keeps the printed envelope identical to the
   * one the controller saw on screen. */
  extent: EnvelopeExtent;

  zfcg: EnvPlottedPoint;
  tocg: EnvPlottedPoint;
  /** Present only after an LMC recomputes ZFCG (Faz 12) — the purple square marker. */
  zfcgCorrected: EnvPlottedPoint | null;

  /** CLAUDE.md rule #8 — NOT FOR OPERATIONAL USE watermark, controlled by the DOCUMENTS_WATERMARK env var. Defaults true until validation is complete (Faz 14). */
  watermark: boolean;
}

/**
 * The frame the CG envelope is drawn on: index 40-200, weight up to 240 000 kg.
 *
 * A fixed frame is what makes two flights' envelopes comparable at a glance —
 * the crew reads the same grid every time instead of re-reading the axis. Pass
 * it to `buildEnvelopeExtent` as the minimum range: real data outside it still
 * widens the axis, so nothing is ever clipped.
 *
 * Presentation only. No AHM 560 limit is encoded here (CLAUDE.md rule #3) —
 * these are the edges of a sheet of paper, not of an envelope.
 */
export const ENV_CHART_FRAME = {
  index: ["40", "200"] as [string, string],
  weight: ["116000", "240000"] as [string, string],
};
