/**
 * Schematic (NOT to scale) top-down layout for the a330-243p2f load-plan
 * diagram — Faz 8. AHM 560 does not publish position coordinates anywhere
 * (no PDF diagram is checked into this repo, no x/y data exists in
 * @tua/ahm-data — confirmed during Faz 8 research), so there is no
 * ground-truth geometry to reproduce. This module instead derives a
 * reasonable, honestly-approximate floor plan directly from information
 * that *is* real:
 *
 *  - Main deck: the 17 lettered bays (A..U, skipping I/N/O/Q) are laid
 *    out left-to-right (nose->tail) in the same order combined-load.json's
 *    zone list (ZA..ZU) uses, with which they're confirmed 1:1
 *    (zone-expansion.ts). A bay's doubled-letter (AA), bridge (AB), and
 *    side-by-side (ABL/ABR) codes all occupy that bay's own visual slot
 *    or span exactly the two bays their code names — never an invented
 *    span. Long-pallet (CFR, FJG, ...) spans are read directly from
 *    combined-load.json's longPalletDistribution zone touch-set (e.g.
 *    CFR touches ZD+ZE -> spans bays D..E), not guessed.
 *  - Lower deck: compartment 1-4 container codes (11-14, 21-23, 31-33,
 *    41-43) are laid out in the same compartment order the codes'
 *    leading digit already encodes (checkCompartmentLimits uses the same
 *    convention). Each "<n>P" pallet code spans its own container slot
 *    plus the next one in the same compartment (e.g. "12P" spans 12+13,
 *    "13P" spans 13+14) — the two overlapping ways a pallet can sit
 *    across a compartment's container pitch. Bulk (51-53) sits aft of
 *    compartment 4.
 *
 * Pending AHM 560 diagram re-verification, same open-question status as
 * the AHM data this leans on (GROUND_TRUTH.md §21).
 */

export interface PositionRect {
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAIN_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "P", "R", "S", "T", "U"] as const;

const SLOT_W = 70;
const SLOT_GAP = 4;
const SLOT_PITCH = SLOT_W + SLOT_GAP;
const MAIN_ROW_Y = 20;
const MAIN_ROW_H = 100;
const SIDE_GAP = 6;
const SIDE_H = (MAIN_ROW_H - SIDE_GAP) / 2;

function letterIndex(letter: string): number {
  const i = MAIN_LETTERS.indexOf(letter as (typeof MAIN_LETTERS)[number]);
  if (i === -1) throw new Error(`aircraft-layout: unknown main-deck letter "${letter}"`);
  return i;
}

function slotX(index: number): number {
  return index * SLOT_PITCH;
}

/** Full x-span (left edge of `from`'s slot to right edge of `to`'s slot). */
function spanRect(from: string, to: string, y: number, h: number): Omit<PositionRect, "code"> {
  const i0 = letterIndex(from);
  const i1 = letterIndex(to);
  const x0 = slotX(i0);
  const x1 = slotX(i1) + SLOT_W;
  return { x: x0, y, w: x1 - x0, h };
}

// Bridge/side-by-side letter pairs, taken verbatim from the position
// codes themselves (positions.json) — not invented.
const BRIDGE_PAIRS: [string, string][] = [
  ["A", "B"],
  ["B", "C"],
  ["C", "E"],
  ["E", "F"],
  ["F", "H"],
  ["H", "J"],
  ["J", "K"],
  ["K", "M"],
  ["M", "P"],
];
// Side-by-side exists for one more span than the single-row bridge does (P-R).
const SIDE_BY_SIDE_PAIRS: [string, string][] = [...BRIDGE_PAIRS, ["P", "R"]];

// Long-pallet spans, read directly from combined-load.json's
// longPalletDistribution zone touch-set (zone == same-lettered bay, see
// zone-expansion.ts) — e.g. CFR distributes across ZD+ZE, so it spans
// bays D..E.
const LONG_PALLET_SPANS: Record<string, [string, string]> = {
  CFR: ["D", "E"],
  FJR: ["E", "G"],
  JLR: ["J", "L"],
  LPR: ["L", "P"],
  CFG: ["D", "F"],
  FJG: ["F", "J"],
  JLG: ["J", "L"],
};

function buildMainDeckLayout(): Record<string, PositionRect> {
  const layout: Record<string, PositionRect> = {};

  MAIN_LETTERS.forEach((letter, i) => {
    const rect = { x: slotX(i), y: MAIN_ROW_Y, w: SLOT_W, h: MAIN_ROW_H };
    layout[letter] = { code: letter, ...rect };
    layout[letter + letter] = { code: letter + letter, ...rect }; // doubled/wide variant, same slot
  });

  for (const [a, b] of BRIDGE_PAIRS) {
    const code = a + b;
    layout[code] = { code, ...spanRect(a, b, MAIN_ROW_Y, MAIN_ROW_H) };
  }

  for (const [a, b] of SIDE_BY_SIDE_PAIRS) {
    const code = a + b;
    const span = spanRect(a, b, MAIN_ROW_Y, SIDE_H);
    layout[code + "L"] = { code: code + "L", ...span };
    layout[code + "R"] = { code: code + "R", x: span.x, y: MAIN_ROW_Y + SIDE_H + SIDE_GAP, w: span.w, h: SIDE_H };
  }

  for (const [code, [from, to]] of Object.entries(LONG_PALLET_SPANS)) {
    layout[code] = { code, ...spanRect(from, to, MAIN_ROW_Y, MAIN_ROW_H) };
  }

  return layout;
}

const MAIN_DECK_LAYOUT = buildMainDeckLayout();
const MAIN_DECK_WIDTH = slotX(MAIN_LETTERS.length - 1) + SLOT_W;
const MAIN_DECK_HEIGHT = MAIN_ROW_Y * 2 + MAIN_ROW_H;

// ---------------------------------------------------------------------------
// Lower deck
// ---------------------------------------------------------------------------

const COMPARTMENT_CONTAINERS: Record<1 | 2 | 3 | 4, string[]> = {
  1: ["11", "12", "13", "14"],
  2: ["21", "22", "23"],
  3: ["31", "32", "33"],
  4: ["41", "42", "43"],
};
const COMPARTMENT_GAP = 24;
const CONTAINER_ROW_Y = 20;
const CONTAINER_H = 60;
const PALLET_ROW_Y = CONTAINER_ROW_Y + CONTAINER_H + 16;
const PALLET_H = 60;
const BULK_CODES = ["51", "52", "53"];

function buildLowerDeckLayout(): Record<string, PositionRect> {
  const layout: Record<string, PositionRect> = {};
  let cursorX = 0;

  const containerX = new Map<string, number>();
  for (const comp of [1, 2, 3, 4] as const) {
    for (const code of COMPARTMENT_CONTAINERS[comp]) {
      layout[code] = { code, x: cursorX, y: CONTAINER_ROW_Y, w: SLOT_W, h: CONTAINER_H };
      containerX.set(code, cursorX);
      cursorX += SLOT_PITCH;
    }
    cursorX += COMPARTMENT_GAP;
  }

  // "<n>P" pallet codes span their own container slot + the next one in
  // the same compartment (e.g. "12P" -> 12+13, "13P" -> 13+14).
  for (const comp of [1, 2, 3, 4] as const) {
    const containers = COMPARTMENT_CONTAINERS[comp];
    for (let i = 0; i < containers.length - 1; i++) {
      const from = containers[i]!;
      const to = containers[i + 1]!;
      const code = `${from}P`;
      const x0 = containerX.get(from)!;
      const x1 = containerX.get(to)! + SLOT_W;
      layout[code] = { code, x: x0, y: PALLET_ROW_Y, w: x1 - x0, h: PALLET_H };
    }
  }

  const bulkStartX = cursorX;
  BULK_CODES.forEach((code, i) => {
    layout[code] = { code, x: bulkStartX + i * SLOT_PITCH, y: CONTAINER_ROW_Y, w: SLOT_W, h: CONTAINER_H + PALLET_H + 16 };
  });

  return layout;
}

const LOWER_DECK_LAYOUT = buildLowerDeckLayout();
const LOWER_DECK_WIDTH = Math.max(...Object.values(LOWER_DECK_LAYOUT).map((r) => r.x + r.w));
const LOWER_DECK_HEIGHT = PALLET_ROW_Y + PALLET_H + 20;

export const AIRCRAFT_LAYOUT = {
  main: { positions: MAIN_DECK_LAYOUT, width: MAIN_DECK_WIDTH, height: MAIN_DECK_HEIGHT },
  lower: { positions: LOWER_DECK_LAYOUT, width: LOWER_DECK_WIDTH, height: LOWER_DECK_HEIGHT },
};

export function getPositionRect(code: string, deck: "MAIN" | "LOWER"): PositionRect | undefined {
  return (deck === "MAIN" ? MAIN_DECK_LAYOUT : LOWER_DECK_LAYOUT)[code];
}
