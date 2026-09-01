/**
 * CG Envelope (ENV) — plain-data input shape. Every numeric limit comes
 * from the caller's `cg-limits.json`-sourced data (CLAUDE.md rule #3);
 * nothing here embeds an AHM breakpoint. The envelope math itself
 * (interpolation, in/out-of-envelope) is @tua/wnb-core's job — this
 * package only draws whatever `EnvelopeCheck`-shaped points it's given.
 */

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
  station: string;
  flightNo: string;
  /** Pre-formatted by the caller, e.g. "11/08/2026". */
  date: string;
  aircraftType: string;
  registration: string;
  /** e.g. "01" for ED01. */
  editionNo: string;
  preparedBy: string;
  checkedBy: string;

  zfwLimits: EnvCgCurve;
  takeoffLimits: EnvCgCurve;
  /** Horizontal red line — no separate landing CG table is published in AHM 560 (GROUND_TRUTH.md §21 Q3); the chart shows MLW as a weight-axis reference line, not an index-bounded curve. */
  mlw: string;
  /** Horizontal black line — minimum operating weight. */
  minWeight: string;

  zfcg: EnvPlottedPoint;
  tocg: EnvPlottedPoint;
  /** Present only after an LMC recomputes ZFCG (Faz 12) — the purple square marker. */
  zfcgCorrected: EnvPlottedPoint | null;

  /** CLAUDE.md rule #8 — NOT FOR OPERATIONAL USE watermark, controlled by the DOCUMENTS_WATERMARK env var. Defaults true until validation is complete (Faz 14). */
  watermark: boolean;
}
