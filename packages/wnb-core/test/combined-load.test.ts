import { describe, expect, it } from "vitest";
import { checkCombinedLoad } from "../src/combined-load";
import { ZfcgOutOfRangeError } from "../src/errors";
import type { CombinedLoadZone } from "../src/types";

// A trimmed-down but real slice of AHM 560 s.55-56 (GROUND_TRUTH.md §12):
// two FWD_CANTILEVER zones and two AFT_CANTILEVER zones, band "22<=ZFCG<23".
const zones: CombinedLoadZone[] = [
  {
    zone: "ZA",
    group: "FWD_CANTILEVER",
    hArm: "16.203",
    cumulativeDirection: "FWD_TO_AFT",
    limits: { "21<=ZFCG<22": "4807", "22<=ZFCG<23": "4726" },
  },
  {
    zone: "ZB",
    group: "FWD_CANTILEVER",
    hArm: "17.965",
    cumulativeDirection: "FWD_TO_AFT",
    limits: { "21<=ZFCG<22": "7089", "22<=ZFCG<23": "6926" },
  },
  {
    zone: "ZF",
    group: "WING_BOX",
    hArm: null,
    cumulativeDirection: null,
    limits: null,
  },
  {
    zone: "ZT",
    group: "AFT_CANTILEVER",
    hArm: "49.369",
    cumulativeDirection: "AFT_TO_FWD",
    limits: { "21<=ZFCG<22": "6489", "22<=ZFCG<23": "6518" },
  },
  {
    zone: "ZU",
    group: "AFT_CANTILEVER",
    hArm: "51.833",
    cumulativeDirection: "AFT_TO_FWD",
    limits: { "21<=ZFCG<22": "3739", "22<=ZFCG<23": "3743" },
  },
];

describe("checkCombinedLoad", () => {
  it("selects the correct ZFCG band", () => {
    const check = checkCombinedLoad({ ZA: "1000", ZB: "1000", ZT: "1000", ZU: "1000" }, "22.5", zones);
    expect(check.band).toBe("22<=ZFCG<23");
  });

  it("cumulates FWD_CANTILEVER zones nose-to-tail (ZA alone, ZB = ZA+ZB)", () => {
    const check = checkCombinedLoad({ ZA: "1000", ZB: "500" }, "21.5", zones);
    const za = check.zones.find((z) => z.zone === "ZA")!;
    const zb = check.zones.find((z) => z.zone === "ZB")!;
    expect(za.cumulativeLoad).toBe("1000");
    expect(zb.cumulativeLoad).toBe("1500");
  });

  it("cumulates AFT_CANTILEVER zones tail-to-nose (ZU alone, ZT = ZU+ZT)", () => {
    const check = checkCombinedLoad({ ZT: "500", ZU: "1000" }, "21.5", zones);
    const zu = check.zones.find((z) => z.zone === "ZU")!;
    const zt = check.zones.find((z) => z.zone === "ZT")!;
    expect(zu.cumulativeLoad).toBe("1000");
    expect(zt.cumulativeLoad).toBe("1500");
  });

  it("reports allWithinLimit: true when every zone is under its band limit", () => {
    const check = checkCombinedLoad({ ZA: "1000", ZB: "500", ZT: "500", ZU: "1000" }, "21.5", zones);
    expect(check.allWithinLimit).toBe(true);
  });

  it("reports allWithinLimit: false and flags the offending zone when a cumulative limit is exceeded", () => {
    // ZA alone limit at band 21<=ZFCG<22 is 4807; 5000 exceeds it.
    const check = checkCombinedLoad({ ZA: "5000" }, "21.5", zones);
    const za = check.zones.find((z) => z.zone === "ZA")!;
    expect(za.withinLimit).toBe(false);
    expect(check.allWithinLimit).toBe(false);
  });

  it("skips WING_BOX zones (no limit)", () => {
    const check = checkCombinedLoad({ ZF: "999999" }, "21.5", zones);
    expect(check.zones.some((z) => z.zone === "ZF")).toBe(false);
  });

  it("throws ZfcgOutOfRangeError outside the table's band coverage", () => {
    expect(() => checkCombinedLoad({}, "10", zones)).toThrow(ZfcgOutOfRangeError);
    expect(() => checkCombinedLoad({}, "50", zones)).toThrow(ZfcgOutOfRangeError);
  });

  it("treats an unloaded zone as zero", () => {
    const check = checkCombinedLoad({}, "21.5", zones);
    expect(check.zones.every((z) => z.cumulativeLoad === "0")).toBe(true);
    expect(check.allWithinLimit).toBe(true);
  });
});
