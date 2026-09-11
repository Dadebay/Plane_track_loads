/**
 * Loadsheet — plain-data input shape. Every field is supplied by the
 * caller; nothing here embeds an AHM constant (CLAUDE.md rule #3). This
 * package renders whatever `WnbResult`/`EnvelopeCheck`/`LimitCheck`
 * values it's given — it never recomputes weight & balance itself
 * (that's @tua/wnb-core's job, CLAUDE.md rule #1's framework-independent
 * boundary applies the same way here as it does to lir/types.ts).
 */

import type { LimitCheck, StabResult } from "@tua/wnb-core";
import type {
  DocumentDeckLayout,
  DocumentFuelTankLine,
  DocumentHeader,
  DocumentUldLine,
} from "../shared/types";

export interface LoadsheetInput {
  /** The station/flight/date/registration/edition/signature set every
   * document shares — one shape, one renderer (../shared/chrome.tsx). */
  header: DocumentHeader;
  destination: string;
  /** Pre-formatted by the caller, e.g. "22:00". */
  time: string;
  /** e.g. "P2F". */
  version: string;
  cockpitCrew: number;
  courierCrew: number;

  /** CLAUDE.md rule #3 / Bulgu #2 fix — which AHM 560 edition/revision this loadsheet was computed against, shown on the document itself. */
  ahmEdition: number;
  ahmRevision: number;

  dow: string;
  doi: string;
  fuelDensity: string;

  /** Freighter flights carry no passengers — still an explicit "0", never omitted (AHM 560 s.13 Sheet C-1 lists the field as mandatory even when zero). */
  passengerCount: number;
  cabinBagWeight: string;

  ttl: string;
  zfw: string;
  mzfw: string;
  takeoffFuel: string;
  tow: string;
  mtow: string;
  tripFuel: string;
  ldw: string;
  mlw: string;
  taxiFuel: string;
  taxiWeight: string;
  mtw: string;

  /** AHM 560's own, correct three-way-minimum calculation — Bulgu #1's fix (Aerometa's 24 722 used a DOW rounded to 110 000). */
  underloadBeforeLmc: string;

  lizfw: string;
  litow: string;
  lilaw: string;
  maczfw: string;
  mactow: string;
  maclaw: string;
  stab: StabResult;

  zfwForwardLimit: string;
  zfwAftLimit: string;
  towForwardLimit: string;
  towAftLimit: string;

  /** Per-compartment/main-deck actual-vs-max, from @tua/wnb-core's checkCompartmentLimits — the "LOAD IN COMPARTMENTS" block. */
  compartments: LimitCheck[];
  /** The plate with this plan's load, from @tua/wnb-core's
   * `buildDeckLayout()` — the same rows the LIR prints and the workspace
   * shows. */
  layout: DocumentDeckLayout;
  /** Loaded positions with the tare/net/gross breakdown. */
  ulds: DocumentUldLine[];

  /** `AUTOMATIC` or `MANUAL`, as recorded on the fuel record. */
  refuelMode: string;
  /** Per-tank allocation when the operator recorded one. `null` prints an
   * explicit "not available" line: AHM 560's FUEL LATERAL MOMENT PER TANK
   * TABLE is still untranscribed (AHM560_ERRATA.md Kayıt 10), and a
   * loadsheet must not imply a tank split nobody supplied. */
  fuelDistribution: DocumentFuelTankLine[] | null;

  /** Faz 12 (LMC) — empty prints "NIL". */
  lastMinuteChanges: { position: string; weightDelta: string; description?: string }[];

  specialInformation: string;
  /** CLAUDE.md rule #8 — NOT FOR OPERATIONAL USE watermark, controlled by the DOCUMENTS_WATERMARK env var. Defaults true until validation is complete (Faz 14). */
  watermark: boolean;
}
