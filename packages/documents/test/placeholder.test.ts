import { describe, expect, it } from "vitest";
import { DOCUMENTS_VERSION } from "../src/index";

describe("documents package wiring", () => {
  it("exports something and builds", () => {
    expect(DOCUMENTS_VERSION).toBeTypeOf("string");
  });
});
