import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { expandLoadToZones } from "../src/zone-expansion";
import { t5692LoadItems } from "./fixtures/t5692";
import type { LoadItem } from "../src/types";

const ahm = loadAhmData("a330-243p2f", 1, 0);

describe("expandLoadToZones", () => {
  it("maps a single-letter bay straight to its same-letter zone", () => {
    const items: LoadItem[] = [{ position: "A", weight: "1000" }];
    const result = expandLoadToZones(items, []);
    expect(result).toEqual({ ZA: "1000" });
  });

  it("maps a doubled-letter (96-inch) bay to the same zone as its single-letter bay", () => {
    const items: LoadItem[] = [{ position: "TT", weight: "2119" }];
    const result = expandLoadToZones(items, []);
    expect(result).toEqual({ ZT: "2119" });
  });

  it("splits a two-letter bridge/side-by-side bay 50/50 across the two zones it spans", () => {
    const items: LoadItem[] = [{ position: "ABL", weight: "700" }];
    const result = expandLoadToZones(items, []);
    expect(result).toEqual({ ZA: "350", ZB: "350" });
  });

  it("splits both L/R halves of a side-by-side pair into the same two zones", () => {
    const items: LoadItem[] = [
      { position: "ABL", weight: "700" },
      { position: "ABR", weight: "800" },
    ];
    const result = expandLoadToZones(items, []);
    expect(result).toEqual({ ZA: "750", ZB: "750" });
  });

  it("uses the explicit longPalletDistribution factors for 16/20ft pallet positions", () => {
    const items: LoadItem[] = [{ position: "CFR", weight: "1000" }];
    const distribution = [{ position: "CFR", distribution: [{ zone: "ZD", factor: "0.6" }, { zone: "ZE", factor: "0.4" }] }];
    const result = expandLoadToZones(items, distribution);
    expect(result).toEqual({ ZD: "600", ZE: "400" });
  });

  it("skips lower-deck/bulk positions entirely", () => {
    const items: LoadItem[] = [
      { position: "11", weight: "472" },
      { position: "52", weight: "340" },
    ];
    expect(expandLoadToZones(items, [])).toEqual({});
  });

  it("conserves total main-deck weight for the real T5 692 golden load", () => {
    const distribution = ahm.zoneMapping.longPalletDistribution;
    const mainDeckItems = t5692LoadItems.filter((item) => ahm.positions.positions.some((p) => p.code === item.position && p.deck === "MAIN"));
    const zones = expandLoadToZones(mainDeckItems, distribution);

    const expectedTotal = mainDeckItems.reduce((sum, item) => sum + Number(item.weight), 0);
    const actualTotal = Object.values(zones).reduce((sum, w) => sum + Number(w), 0);
    expect(actualTotal).toBeCloseTo(expectedTotal, 6);
  });
});
