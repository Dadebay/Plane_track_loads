import type { FuelState, ImbalanceCheck, LoadItem } from "./types";

/**
 * AHM 560 s.74 — lateral (side-by-side) imbalance check.
 *
 * NOT IMPLEMENTED: AHM 560's lateral imbalance limits live on s.74
 * (Load & Trim Sheet Appendix I), which — unlike the combined-load and
 * bay/section trim tables — has no extractable text layer; it's a
 * graphical/diagram page (confirmed during Faz 2 extraction, same as the
 * zone-distribution page s.76, but s.74's diagram was never transcribed
 * because no numeric values were legible in it at all, not even
 * visually). No lateral imbalance data exists anywhere in
 * `@tua/ahm-data` as a result — see GROUND_TRUTH.md §21 Q8.
 *
 * Per CLAUDE.md rule #3 ("no AHM constant may be hardcoded"), this
 * function cannot invent a limit. It always reports NOT_AVAILABLE until
 * someone re-extracts s.74 at high resolution (or the airline supplies
 * the limits directly) and a real limits table is added to
 * `@tua/ahm-data` and threaded through here as a parameter.
 */
export function checkLateralImbalance(
  _loadItems: LoadItem[],
  _fuelState: FuelState,
): ImbalanceCheck {
  return {
    status: "NOT_AVAILABLE",
    reason:
      "Lateral imbalance limits (AHM 560 s.74) were not extractable in Faz 2 — see GROUND_TRUTH.md §21 Q8. " +
      "No limit data is available to check against.",
  };
}
