import { describe, expect, it } from "vitest";
import { MESSAGING_VERSION } from "../src/index";

describe("messaging package wiring", () => {
  it("exports something and builds", () => {
    expect(MESSAGING_VERSION).toBeTypeOf("string");
  });
});
