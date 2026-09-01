import { describe, expect, it } from "vitest";
import { DB_VERSION } from "../src/index";

describe("db package wiring", () => {
  it("exports something and builds", () => {
    expect(DB_VERSION).toBeTypeOf("string");
  });
});
