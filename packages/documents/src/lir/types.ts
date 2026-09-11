/**
 * LIR (Loading Instruction Report) — plain-data input shape. Every field
 * is supplied by the caller; nothing here embeds an AHM constant
 * (CLAUDE.md rule #3). `date` is pre-formatted by the caller — this
 * package never applies locale/formatting rules itself.
 */

import type { DocumentDeckLayout, DocumentHeader } from "../shared/types";

export interface LirCompartmentLimit {
  number: number;
  description: string;
  lirSubLimit: string;
  /** The compartment this one shares a combined maximum with, or null when it
   * is limited on its own (the bulk hold). */
  pairedWith: number | null;
  /** That combined maximum, printed over the pair. */
  maxGrossPair: string;
}

export interface LirInput {
  header: DocumentHeader;
  mainDeckMaxLoad: string;
  compartments: LirCompartmentLimit[];
  /** The plate, from @tua/wnb-core's `buildDeckLayout()` plus this plan's
   * load — the same rows the load-plan workspace draws on screen. */
  layout: DocumentDeckLayout;
  specialInformation: string;
  /** CLAUDE.md rule #8 — NOT FOR OPERATIONAL USE watermark, controlled by
   * the DOCUMENTS_WATERMARK env var. Defaults true until validation is
   * complete (Faz 14). */
  watermark: boolean;
}
