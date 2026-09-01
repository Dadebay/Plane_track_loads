import { describe, expect, it } from "vitest";
import { rangesOverlap } from "../src/lib/aircraft-conflict";

const d = (s: string) => new Date(s);

describe("rangesOverlap", () => {
  it("detects a clear overlap", () => {
    expect(rangesOverlap(d("2026-08-11T10:00Z"), d("2026-08-11T14:00Z"), d("2026-08-11T12:00Z"), d("2026-08-11T16:00Z"))).toBe(
      true,
    );
  });

  it("detects one range fully containing another", () => {
    expect(rangesOverlap(d("2026-08-11T08:00Z"), d("2026-08-11T20:00Z"), d("2026-08-11T10:00Z"), d("2026-08-11T12:00Z"))).toBe(
      true,
    );
  });

  it("does not flag back-to-back turnarounds as a conflict (touching endpoints)", () => {
    expect(rangesOverlap(d("2026-08-11T10:00Z"), d("2026-08-11T14:00Z"), d("2026-08-11T14:00Z"), d("2026-08-11T18:00Z"))).toBe(
      false,
    );
  });

  it("does not flag genuinely separate ranges", () => {
    expect(rangesOverlap(d("2026-08-11T10:00Z"), d("2026-08-11T12:00Z"), d("2026-08-11T14:00Z"), d("2026-08-11T16:00Z"))).toBe(
      false,
    );
  });

  it("is symmetric", () => {
    const a = [d("2026-08-11T10:00Z"), d("2026-08-11T14:00Z")] as const;
    const b = [d("2026-08-11T12:00Z"), d("2026-08-11T16:00Z")] as const;
    expect(rangesOverlap(a[0], a[1], b[0], b[1])).toBe(rangesOverlap(b[0], b[1], a[0], a[1]));
  });
});
