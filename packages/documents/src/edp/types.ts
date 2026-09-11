/**
 * EDP — the Loading Instruction / Report as a ramp working form.
 *
 * Where the LIR is the finished record of a load, this is the sheet the ramp
 * carries to the aircraft: every position printed with what to put in it and
 * a blank line to write back what actually went in. The two are separate
 * documents with separate editions because they are signed at different
 * moments.
 *
 * Plain data only; nothing here embeds an AHM constant (CLAUDE.md rule #3).
 */

import type { DocumentHeader } from "../shared/types";

export interface EdpPositionLine {
  /** Position code, e.g. "RR". */
  code: string;
  /** ULD planned for this position, when one is assigned. */
  uldCode: string | null;
  /** Destination the load is going to, e.g. "URC". `null` for an empty
   * position, which prints NOFIT. */
  destination: string | null;
  /** Gross weight planned, pre-formatted by the caller. `null` = empty. */
  grossWeight: string | null;
}

/** One printed line: a position, and the position printed beside it (an L/R
 * pair, or the matching cell of the configuration row alongside). `null` where
 * the line carries only one position. */
export type EdpLine = [EdpPositionLine, EdpPositionLine | null];

export interface EdpRow {
  /** Heading over the left column, e.g. `Single Row 88"x125"`. Empty where the
   * block prints no heading (the lower-deck compartments). */
  label: string;
  /** Heading over the right column, when two configuration rows are printed
   * side by side the way the plate reads them. */
  rightLabel?: string;
  lines: EdpLine[];
}

export interface EdpDeckSection {
  /** e.g. "MD", "1", "5" — the compartment this block belongs to. */
  compartment: string;
  /** Published maximum for that compartment, pre-formatted. `null` where the
   * AHM publishes no figure for the block — never a computed stand-in. */
  maxLoad: string | null;
  /** Planned total for this compartment, pre-formatted. Printed under the
   * block as `CPT <n> TOTAL`, which is what the ramp checks against MAX. */
  total: string;
  rows: EdpRow[];
}

export interface EdpPlannedLoadLine {
  destination: string;
  /** Content code to weight, e.g. `[["C", "4919"], ["Y", "nill"]]`. The
   * caller decides what "no load" reads as; this package prints it. */
  entries: [string, string][];
}

export interface EdpInput {
  header: DocumentHeader;
  /** Pre-formatted departure time, e.g. "05:40". */
  time: string;
  /** Aircraft version, e.g. "P2F". */
  version: string;
  from: string;
  to: string;
  plannedLoad: EdpPlannedLoadLine[];
  sections: EdpDeckSection[];
  /** Free-text SI, printed above the certification statement. */
  specialInformation: string;
  /** CLAUDE.md rule #8 — NOT FOR OPERATIONAL USE watermark. */
  watermark: boolean;
}
