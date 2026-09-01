import { describe, expect, it } from "vitest";
import {
  addAddress,
  addressesForMessageType,
  assertValidAddress,
  isValidEmailAddress,
  isValidSitaAddress,
  removeAddress,
  type AddressBook,
} from "../src/address-book";

describe("isValidSitaAddress", () => {
  it("accepts the project's known SITA address", () => {
    expect(isValidSitaAddress("ASBDBT5")).toBe(true);
  });

  it("rejects addresses of the wrong length", () => {
    expect(isValidSitaAddress("ASBDB")).toBe(false);
    expect(isValidSitaAddress("ASBDBT55")).toBe(false);
  });
});

describe("isValidEmailAddress", () => {
  it("accepts a well-formed email", () => {
    expect(isValidEmailAddress("groundhandling@turkmenistanairlines.tm")).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(isValidEmailAddress("not-an-email")).toBe(false);
  });
});

describe("assertValidAddress", () => {
  it("throws when neither sita nor email is present", () => {
    expect(() => assertValidAddress({})).toThrow();
  });

  it("throws on an invalid sita field even if present", () => {
    expect(() => assertValidAddress({ sita: "BAD" })).toThrow();
  });

  it("accepts a valid sita-only address", () => {
    expect(() => assertValidAddress({ sita: "ASBDBT5" })).not.toThrow();
  });
});

describe("address book", () => {
  it("adds and filters by message type", () => {
    let book: AddressBook = [];
    book = addAddress(book, { messageType: "LDM", address: { sita: "ASBDBT5" }, label: "ASB ops" });
    book = addAddress(book, { messageType: "MVT", address: { email: "ops@turkmenistanairlines.tm" } });

    expect(addressesForMessageType(book, "LDM")).toHaveLength(1);
    expect(addressesForMessageType(book, "MVT")).toHaveLength(1);
    expect(addressesForMessageType(book, "CPM")).toHaveLength(0);
  });

  it("rejects a duplicate (messageType, address) entry", () => {
    let book: AddressBook = [];
    book = addAddress(book, { messageType: "LDM", address: { sita: "ASBDBT5" } });
    expect(() => addAddress(book, { messageType: "LDM", address: { sita: "ASBDBT5" } })).toThrow();
  });

  it("allows the same address for two different message types", () => {
    let book: AddressBook = [];
    book = addAddress(book, { messageType: "LDM", address: { sita: "ASBDBT5" } });
    expect(() => addAddress(book, { messageType: "MVT", address: { sita: "ASBDBT5" } })).not.toThrow();
  });

  it("removes an entry without mutating the original array", () => {
    let book: AddressBook = [];
    book = addAddress(book, { messageType: "LDM", address: { sita: "ASBDBT5" } });
    const beforeLength = book.length;
    const after = removeAddress(book, "LDM", { sita: "ASBDBT5" });

    expect(book).toHaveLength(beforeLength);
    expect(after).toHaveLength(0);
  });
});
