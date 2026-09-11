/**
 * One visual vocabulary for LIR, Loadsheet and ENV.
 *
 * The three T5 477 reference documents share a single print language:
 * hairline-boxed field tables, uppercase English aviation labels, a small
 * branded block top-left, everything on one A4 page. Before this file each
 * of our three renderers carried its own copy of those numbers and drifted
 * from the others. They are presentation values (paddings, greys, font
 * sizes) — no AHM 560 constant belongs here (CLAUDE.md rule #3).
 *
 * PDFs are always light-themed (CLAUDE.md's theme rule), so these are
 * absolute colours, not theme tokens.
 */

export const PAGE = {
  /** A4 at 24pt margins leaves 547.28pt of usable width. */
  padding: 24,
  baseFontSize: 7,
} as const;

export const COLOR = {
  ink: "#111111",
  inkMuted: "#555555",
  inkSubtle: "#777777",
  rule: "#333333",
  hairline: "#999999",
  grid: "#cccccc",
  fill: "#f0f0f0",
  fillMuted: "#f5f5f5",
  blocked: "#8a8a8a",
  /** Turkmenistan Airlines' corporate green, used for the wordmark block
   * only. Drawn from text and shapes — no pixels are taken from any
   * reference document. */
  brand: "#0f7a3d",
  danger: "#cc0000",
  dangerFill: "#fdeaea",
  forward: "#15803d",
  takeoff: "#1d4ed8",
  corrected: "#7e22ce",
} as const;

export const FONT = {
  family: "Helvetica",
  /** Cell text inside the position grid — the densest thing on the page. */
  micro: 5.5,
  small: 6.5,
  body: 7.5,
  label: 7,
  sectionTitle: 8.5,
  title: 13,
} as const;

export const RULE = {
  hairline: 1,
} as const;
