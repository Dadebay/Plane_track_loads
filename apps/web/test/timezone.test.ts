import { describe, expect, it } from "vitest";
import { utcToZonedTimeString, zonedTimeToUtc } from "../src/lib/timezone";

describe("zonedTimeToUtc", () => {
  it("converts SGN (Asia/Ho_Chi_Minh, UTC+7, no DST) local time to UTC", () => {
    // 22:00 local at SGN on 2026-08-11 == 15:00 UTC (matches the T5 692
    // golden test case's seed data — see packages/db/prisma/seed.ts).
    const utc = zonedTimeToUtc("2026-08-11T22:00", "Asia/Ho_Chi_Minh");
    expect(utc.toISOString()).toBe("2026-08-11T15:00:00.000Z");
  });

  it("converts ASB (Asia/Ashgabat, UTC+5, no DST) local time to UTC", () => {
    const utc = zonedTimeToUtc("2026-08-12T02:00", "Asia/Ashgabat");
    expect(utc.toISOString()).toBe("2026-08-11T21:00:00.000Z");
  });

  it("round-trips through a DST-observing zone (Europe/Berlin, summer = UTC+2)", () => {
    const utc = zonedTimeToUtc("2026-08-18T09:00", "Europe/Berlin");
    expect(utc.toISOString()).toBe("2026-08-18T07:00:00.000Z");
  });

  it("round-trips through a DST-observing zone in winter (UTC+1)", () => {
    const utc = zonedTimeToUtc("2026-01-15T09:00", "Europe/Berlin");
    expect(utc.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });
});

describe("utcToZonedTimeString", () => {
  it("is the exact inverse of zonedTimeToUtc across several zones", () => {
    const cases: [string, string][] = [
      ["2026-08-11T22:00", "Asia/Ho_Chi_Minh"],
      ["2026-08-12T02:00", "Asia/Ashgabat"],
      ["2026-08-18T09:00", "Europe/Berlin"],
      ["2026-01-15T09:00", "Europe/Berlin"],
    ];
    for (const [local, tz] of cases) {
      const utc = zonedTimeToUtc(local, tz);
      expect(utcToZonedTimeString(utc, tz)).toBe(local);
    }
  });
});
