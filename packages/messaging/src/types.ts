/**
 * @tua/messaging — shared domain types.
 *
 * Encoders take plain data, not @tua/wnb-core's Decimal-bearing internals —
 * only the decimal *strings* that WnbResult/LoadItem already expose, so
 * this package stays a thin formatting layer over data the caller (Faz 8
 * load planning, Faz 3 wnb-core) has already computed.
 */

export type MessagePriority = "QU" | "QD" | "QX";

export type MessageType = "LDM" | "CPM" | "MVT" | "FFM" | "FBL";

export interface StationAddress {
  /** 7-letter SITA address, e.g. "ASBDBT5" (3-letter station + 2-letter dept + 2-letter type/airline suffix). */
  sita?: string;
  email?: string;
}

export interface FlightRef {
  /** e.g. "T5692" — no space, per Type B convention. */
  flightNo: string;
  /** ISO date of the leg, e.g. "2026-08-11". */
  date: string;
  origin: string;
  destination: string;
  aircraftRegistration: string;
}

export interface CompartmentLoad {
  number: number;
  weight: string;
}

// ---------------------------------------------------------------------------
// LDM — Load Message (AHM 583)
// ---------------------------------------------------------------------------

export interface LdmInput {
  flight: FlightRef;
  originator: StationAddress;
  /** Appended to the message when re-sending a corrected LDM for the same flight/date, e.g. "A". */
  editionSuffix?: string;
  mainDeckWeight: string;
  compartments: CompartmentLoad[];
  totalTrafficLoad: string;
  /** Freighter flights carry no passengers; pass 0 explicitly rather than omitting the field. */
  passengers: number;
  specialInformation?: string;
}

// ---------------------------------------------------------------------------
// CPM — Container/Pallet Message (dispatch: AHM 388, acceptance: AHM 587)
// ---------------------------------------------------------------------------

export interface CpmPositionLoad {
  position: string;
  uldCode?: string;
  awb?: string;
  weight: string;
  /** B/C/M/P/S/E per AHM 560 LIR content codes. */
  contentCode?: string;
}

export interface CpmDispatchInput {
  flight: FlightRef;
  originator: StationAddress;
  editionSuffix?: string;
  positions: CpmPositionLoad[];
  specialInformation?: string;
}

export interface ParsedCpmPositionLoad {
  position: string;
  uldCode: string | null;
  awb: string | null;
  weight: string;
  contentCode: string | null;
}

export interface ParsedCpmAcceptance {
  flightNo: string;
  date: string;
  origin: string;
  destination: string;
  positions: ParsedCpmPositionLoad[];
  specialInformation: string | null;
}

// ---------------------------------------------------------------------------
// MVT — Movement Message (AHM 011/780)
// ---------------------------------------------------------------------------

export type MvtEvent = "OFF" | "ON" | "ARR" | "DEP";

export interface MvtInput {
  flight: FlightRef;
  originator: StationAddress;
  event: MvtEvent;
  /** Actual time of the event, "HH:mm" UTC. */
  actualTime: string;
  /** Optional traffic figures — freighters typically report 0 for all classes. */
  paxOnBoard?: number;
  totalTrafficLoad?: string;
  specialInformation?: string;
}

// ---------------------------------------------------------------------------
// FFM — Flight Manifest
// ---------------------------------------------------------------------------

export interface FfmAwbLine {
  awb: string;
  origin: string;
  destination: string;
  pieces: number;
  weight: string;
  contentDescription?: string;
}

export interface FfmInput {
  flight: FlightRef;
  originator: StationAddress;
  awbs: FfmAwbLine[];
}

// ---------------------------------------------------------------------------
// FBL — Freight Booked List
// ---------------------------------------------------------------------------

export interface FblAwbLine {
  awb: string;
  origin: string;
  destination: string;
  pieces: number;
  weight: string;
  bookedForFlight: string;
  bookedForDate: string;
}

export interface FblInput {
  station: string;
  originator: StationAddress;
  awbs: FblAwbLine[];
}
