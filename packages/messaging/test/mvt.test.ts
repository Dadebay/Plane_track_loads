import { describe, expect, it } from "vitest";
import { encodeMvt } from "../src/mvt";
import type { MvtInput } from "../src/types";

const flight = {
  flightNo: "T5692",
  date: "2026-08-11",
  origin: "SGN",
  destination: "ASB",
  aircraftRegistration: "EZ-F430",
};

describe("encodeMvt", () => {
  it("encodes a departure (OFF) event", () => {
    const input: MvtInput = {
      flight,
      originator: { sita: "SGNDBT5" },
      event: "OFF",
      actualTime: "22:05",
      paxOnBoard: 0,
      totalTrafficLoad: "35278",
    };
    const lines = encodeMvt(input).split("\r\n");
    expect(lines[0]).toBe("MVT");
    expect(lines[1]).toBe("T5692/11AUG.SGNASB");
    expect(lines).toContain("OFF/2205");
    expect(lines).toContain("PAX/0");
    expect(lines).toContain("TTL/35278");
  });

  it("encodes an arrival (ON) event with no traffic figures", () => {
    const input: MvtInput = {
      flight,
      originator: { sita: "ASBDBT5" },
      event: "ON",
      actualTime: "0310",
    };
    const lines = encodeMvt(input).split("\r\n");
    expect(lines).toContain("ON/0310");
    expect(lines.some((l) => l.startsWith("PAX/"))).toBe(false);
    expect(lines.some((l) => l.startsWith("TTL/"))).toBe(false);
  });

  it("wraps special information", () => {
    const input: MvtInput = {
      flight,
      originator: { sita: "ASBDBT5" },
      event: "ON",
      actualTime: "0310",
      specialInformation: "diverted due to weather",
    };
    const lines = encodeMvt(input).split("\r\n");
    expect(lines).toContain("SI");
    expect(lines).toContain("DIVERTED DUE TO WEATHER");
  });
});
