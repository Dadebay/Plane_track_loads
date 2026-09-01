/**
 * LIR (Loading Instruction Report) — plain-data input shape. Every field
 * is supplied by the caller; nothing here embeds an AHM constant
 * (CLAUDE.md rule #3). `date` is pre-formatted by the caller — this
 * package never applies locale/formatting rules itself.
 */

export interface LirCell {
  code: string;
  deck: "MAIN" | "LOWER";
  maxGross: string;
  uldCode: string | null;
  awb: string | null;
  /** null (position empty) renders as "N" per AHM 560 LIR convention. */
  weight: string | null;
}

export interface LirCompartmentLimit {
  number: number;
  description: string;
  lirSubLimit: string;
}

export interface LirInput {
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
  mainDeckMaxLoad: string;
  compartments: LirCompartmentLimit[];
  /** One entry per position, in the order they should be printed —
   * ordering is the caller's responsibility (see aircraft-layout.ts in
   * apps/web for the canonical fwd-to-aft sequence). */
  cells: LirCell[];
  specialInformation: string;
  /** CLAUDE.md rule #8 — NOT FOR OPERATIONAL USE watermark, controlled by
   * the DOCUMENTS_WATERMARK env var. Defaults true until validation is
   * complete (Faz 14). */
  watermark: boolean;
}
