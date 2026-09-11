/**
 * Plain-data shapes shared by LIR, Loadsheet and ENV.
 *
 * @tua/documents renders; it never derives. The grid rows below mirror
 * `DeckLayoutRow` from @tua/wnb-core's `buildDeckLayout()` — the same
 * function that lays out the load-plan workspace on screen — with the
 * per-position load added by the caller. That is what makes screen and
 * print show the same plate (Aşama 7 "paylaşılan yerleşim verisi"); this
 * package deliberately holds no copy of the grouping logic.
 */

/** Header fields every one of the three documents prints. */
export interface DocumentHeader {
  station: string;
  flightNo: string;
  /** Pre-formatted by the caller, e.g. "05/09/2026". */
  date: string;
  aircraftType: string;
  registration: string;
  /** e.g. "01" for ED01. */
  editionNo: string;
  preparedBy: string;
  checkedBy: string;
}

export interface DocumentDeckCell {
  code: string;
  maxGross: string;
  /** null = position empty; prints "N" per the AHM 560 LIR convention. */
  uldCode: string | null;
  awb: string | null;
  weight: string | null;
  /** Set when another loaded position's footprint takes this cell out of
   * play — printed as a shaded cell, exactly as the reference plate shades
   * mutually exclusive positions. */
  blocked?: boolean;
}

export interface DocumentDeckRow {
  id: string;
  /** The plate's own row label, e.g. `SINGLE ROW 96"x125"`. */
  label: string;
  cells: DocumentDeckCell[];
}

export interface DocumentDeckLayout {
  main: DocumentDeckRow[];
  lower: DocumentDeckRow[];
}

/** One loaded ULD, for the manifest table that carries the tare/net/gross
 * breakdown added in Aşama 4. Gross is what W&B consumed. */
export interface DocumentUldLine {
  position: string;
  uldCode: string | null;
  awb: string | null;
  contentCode: string | null;
  tareWeight: string | null;
  netWeight: string | null;
  grossWeight: string;
}

/** Per-tank fuel, when the operator's allocation is on record. `null`
 * overall means no per-tank data exists for this flight — the document
 * says so rather than implying an even split (CLAUDE.md rule #9's
 * "invent nothing" applies to documents too). */
export interface DocumentFuelTankLine {
  tank: string;
  side: string;
  weight: string;
}
