import { describe, expect, it } from "vitest";
import { AHM_DATA_VERSION } from "../src/index";

describe("ahm-data package wiring", () => {
  it("exports something and builds", () => {
    expect(AHM_DATA_VERSION).toBeTypeOf("string");
  });
});
