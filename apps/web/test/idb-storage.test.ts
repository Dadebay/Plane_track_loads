// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { idbStorage } from "../src/lib/idb-storage";

describe("idbStorage", () => {
  it("returns null for a key that was never set", async () => {
    expect(await idbStorage.getItem("nonexistent")).toBeNull();
  });

  it("round-trips a value through setItem/getItem", async () => {
    await idbStorage.setItem("foo", JSON.stringify({ a: 1 }));
    expect(await idbStorage.getItem("foo")).toBe(JSON.stringify({ a: 1 }));
  });

  it("overwrites an existing value", async () => {
    await idbStorage.setItem("bar", "first");
    await idbStorage.setItem("bar", "second");
    expect(await idbStorage.getItem("bar")).toBe("second");
  });

  it("removes a value", async () => {
    await idbStorage.setItem("baz", "value");
    await idbStorage.removeItem("baz");
    expect(await idbStorage.getItem("baz")).toBeNull();
  });

  it("keeps separate keys independent", async () => {
    await idbStorage.setItem("k1", "v1");
    await idbStorage.setItem("k2", "v2");
    expect(await idbStorage.getItem("k1")).toBe("v1");
    expect(await idbStorage.getItem("k2")).toBe("v2");
  });
});
