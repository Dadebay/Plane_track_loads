import { describe, expect, it } from "vitest";
import { WNB_CORE_VERSION } from "../src/index";

describe("wnb-core package wiring", () => {
  it("exports something and builds", () => {
    expect(WNB_CORE_VERSION).toBeTypeOf("string");
  });
});
