/**
 * @tua/wnb-core — Weight & Balance calculation engine.
 *
 * Zero framework dependency. Only runtime dependency is decimal.js.
 * All constants come from @tua/ahm-data, never hardcoded here.
 * See docs/AHM560_GROUND_TRUTH.md for the source of truth this package
 * is validated against (T5 692 golden test case, §19).
 */

export const WNB_CORE_VERSION = "0.0.0-faz3";

export * from "./types";
export * from "./errors";
export * from "./formula";
export * from "./dow-doi";
export * from "./fuel";
export * from "./envelope";
export * from "./combined-load";
export * from "./zone-expansion";
export * from "./compartment-limits";
export * from "./lateral-imbalance";
export * from "./underload";
export * from "./wnb";
export * from "./lmc";
export * from "./trim-optimizer";
