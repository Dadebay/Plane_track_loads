/**
 * Distribution list management for outgoing messages — which SITA/email
 * addresses receive which message type. Pure functions over a plain array
 * so the caller (apps/web, backed by @tua/db) can persist it however it
 * likes; this package has no storage of its own (CLAUDE.md rule #1's
 * framework-independence spirit, applied to messaging too).
 */

import type { MessageType, StationAddress } from "./types";

export interface AddressBookEntry {
  messageType: MessageType;
  address: StationAddress;
  label?: string;
}

export type AddressBook = readonly AddressBookEntry[];

const SITA_ADDRESS_RE = /^[A-Z]{3}[A-Z0-9]{2}[A-Z0-9]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidSitaAddress(value: string): boolean {
  return SITA_ADDRESS_RE.test(value);
}

export function isValidEmailAddress(value: string): boolean {
  return EMAIL_RE.test(value);
}

/** Throws if the address has neither a valid SITA address nor a valid email — at least one is required. */
export function assertValidAddress(address: StationAddress): void {
  const hasSita = address.sita !== undefined;
  const hasEmail = address.email !== undefined;
  if (!hasSita && !hasEmail) {
    throw new Error("address must have a sita or email field");
  }
  if (hasSita && !isValidSitaAddress(address.sita as string)) {
    throw new Error(`invalid SITA address: "${address.sita}"`);
  }
  if (hasEmail && !isValidEmailAddress(address.email as string)) {
    throw new Error(`invalid email address: "${address.email}"`);
  }
}

function sameAddress(a: StationAddress, b: StationAddress): boolean {
  return a.sita === b.sita && a.email === b.email;
}

/** Returns a new book with the entry added. Throws on an invalid address or an exact (messageType, address) duplicate. */
export function addAddress(book: AddressBook, entry: AddressBookEntry): AddressBook {
  assertValidAddress(entry.address);
  const isDuplicate = book.some(
    (e) => e.messageType === entry.messageType && sameAddress(e.address, entry.address),
  );
  if (isDuplicate) {
    throw new Error(`address already registered for ${entry.messageType}`);
  }
  return [...book, entry];
}

/** Returns a new book with the matching (messageType, address) entry removed, if present. */
export function removeAddress(book: AddressBook, messageType: MessageType, address: StationAddress): AddressBook {
  return book.filter((e) => !(e.messageType === messageType && sameAddress(e.address, address)));
}

export function addressesForMessageType(book: AddressBook, messageType: MessageType): AddressBookEntry[] {
  return book.filter((e) => e.messageType === messageType);
}
