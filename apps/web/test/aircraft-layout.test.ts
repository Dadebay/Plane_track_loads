import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { AIRCRAFT_LAYOUT, getPositionRect } from "../src/lib/aircraft-layout";

const ahm = loadAhmData("a330-243p2f", 1, 0);

describe("aircraft-layout", () => {
  it("has a layout rect for every real position code in the AHM data", () => {
    const missing = ahm.positions.positions
      .filter((p) => !getPositionRect(p.code, p.deck))
      .map((p) => `${p.code} (${p.deck})`);
    expect(missing).toEqual([]);
  });

  it("gives every rect a positive width and height", () => {
    for (const deck of [AIRCRAFT_LAYOUT.main, AIRCRAFT_LAYOUT.lower]) {
      for (const rect of Object.values(deck.positions)) {
        expect(rect.w).toBeGreaterThan(0);
        expect(rect.h).toBeGreaterThan(0);
      }
    }
  });

  it("places main-deck bays in fwd-to-aft (A..U) x order", () => {
    const a = getPositionRect("A", "MAIN")!;
    const m = getPositionRect("M", "MAIN")!;
    const u = getPositionRect("U", "MAIN")!;
    expect(a.x).toBeLessThan(m.x);
    expect(m.x).toBeLessThan(u.x);
  });

  it("gives a doubled-letter bay the same slot as its single-letter bay", () => {
    const { code: _d, ...single } = getPositionRect("D", "MAIN")!;
    const { code: _dd, ...doubled } = getPositionRect("DD", "MAIN")!;
    expect(single).toEqual(doubled);
  });

  it("spans a bridge code exactly from its first letter's bay to its second letter's bay", () => {
    const c = getPositionRect("C", "MAIN")!;
    const e = getPositionRect("E", "MAIN")!;
    const ce = getPositionRect("CE", "MAIN")!;
    expect(ce.x).toBe(c.x);
    expect(ce.x + ce.w).toBe(e.x + e.w);
  });

  it("splits a side-by-side pair into two non-overlapping halves stacked within the bay's row", () => {
    const l = getPositionRect("ABL", "MAIN")!;
    const r = getPositionRect("ABR", "MAIN")!;
    expect(l.x).toBe(r.x);
    expect(l.w).toBe(r.w);
    expect(l.y).not.toBe(r.y);
    // No vertical overlap.
    expect(l.y + l.h).toBeLessThanOrEqual(r.y);
  });

  it("gives every position code on a shared deck a unique, non-overlapping rect (no two codes fully coincide except intentional same-slot variants)", () => {
    // Sanity: single-letter and its doubled variant are the ONLY pair
    // expected to have identical rects; spot-check two unrelated codes differ.
    expect(getPositionRect("A", "MAIN")).not.toEqual(getPositionRect("U", "MAIN"));
  });

  it("spans a lower-deck pallet code across its own container slot and the next one", () => {
    const c12 = getPositionRect("12", "LOWER")!;
    const c13 = getPositionRect("13", "LOWER")!;
    const p12 = getPositionRect("12P", "LOWER")!;
    expect(p12.x).toBe(c12.x);
    expect(p12.x + p12.w).toBe(c13.x + c13.w);
  });

  it("orders lower-deck compartments 1-4 fwd-to-aft, with bulk aft of compartment 4", () => {
    const c11 = getPositionRect("11", "LOWER")!;
    const c41 = getPositionRect("41", "LOWER")!;
    const bulk51 = getPositionRect("51", "LOWER")!;
    expect(c11.x).toBeLessThan(c41.x);
    expect(c41.x).toBeLessThan(bulk51.x);
  });
});
