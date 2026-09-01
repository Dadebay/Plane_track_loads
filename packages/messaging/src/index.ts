/**
 * @tua/messaging — IATA message encoders (LDM, CPM, MVT, FFM, FBL).
 *
 * Pure formatting layer: no framework dependency, no storage, no network
 * transport. Encoders take plain input shapes (decimal-string weights,
 * ISO dates) and return Type B message text; apps/web supplies the
 * SITA/SMTP transport and DB-backed address book / audit persistence.
 *
 * IATA AHM 583/388/587/011/780 message formats are implemented per the
 * standard published structure — AHM 560 (this project's source document,
 * s.8) lists which messages are required but does not itself specify
 * their wire format. Verify against an authoritative SITA/IATA specimen
 * before operational use, same caution as the NOT FOR OPERATIONAL USE
 * watermark on generated PDFs (CLAUDE.md rule #8).
 */

export const MESSAGING_VERSION = "0.0.0-faz13";

export * from "./types";
export * from "./format-utils";
export { encodeLdm } from "./ldm";
export { encodeCpmDispatch, parseCpmAcceptance } from "./cpm";
export { encodeMvt } from "./mvt";
export { encodeFfm } from "./ffm";
export { encodeFbl } from "./fbl";
export * from "./address-book";
export * from "./queue";
