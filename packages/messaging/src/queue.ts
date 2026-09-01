/**
 * Transport-agnostic send queue: retry/backoff state machine and delivery
 * record, so a failed send is retried and reported (plan Faz 13 task 8).
 *
 * This package defines no actual SITA/SMTP transport — that lives in
 * apps/web, which injects a `Transport` implementation. Everything here
 * is pure data transitions, so it's fully testable with a mock transport
 * and no network or DB.
 */

import type { MessageType, StationAddress } from "./types";

export interface OutgoingMessage {
  messageType: MessageType;
  address: StationAddress;
  body: string;
}

export type QueuedMessageStatus = "PENDING" | "RETRYING" | "SENT" | "FAILED";

export interface QueuedMessage {
  id: string;
  message: OutgoingMessage;
  status: QueuedMessageStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  /** ISO timestamp; null once SENT or FAILED (permanently). */
  nextAttemptAt: string | null;
}

export interface Transport {
  send(message: OutgoingMessage): Promise<void>;
}

export const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

export function createQueuedMessage(id: string, message: OutgoingMessage, now: Date = new Date()): QueuedMessage {
  return {
    id,
    message,
    status: "PENDING",
    attempts: 0,
    lastError: null,
    createdAt: now.toISOString(),
    nextAttemptAt: now.toISOString(),
  };
}

/** Exponential backoff with a cap: attempt 1 -> 30s, 2 -> 60s, 3 -> 120s, ... capped at 30min. */
export function computeBackoffMs(attempt: number): number {
  const raw = BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(raw, MAX_BACKOFF_MS);
}

export function isDue(item: QueuedMessage, now: Date = new Date()): boolean {
  if (item.status !== "PENDING" && item.status !== "RETRYING") return false;
  if (item.nextAttemptAt === null) return false;
  return new Date(item.nextAttemptAt).getTime() <= now.getTime();
}

function recordFailure(
  item: QueuedMessage,
  error: string,
  now: Date,
  maxAttempts: number,
): QueuedMessage {
  const attempts = item.attempts + 1;
  const exhausted = attempts >= maxAttempts;
  return {
    ...item,
    attempts,
    lastError: error,
    status: exhausted ? "FAILED" : "RETRYING",
    nextAttemptAt: exhausted ? null : new Date(now.getTime() + computeBackoffMs(attempts)).toISOString(),
  };
}

function recordSuccess(item: QueuedMessage): QueuedMessage {
  return {
    ...item,
    attempts: item.attempts + 1,
    status: "SENT",
    lastError: null,
    nextAttemptAt: null,
  };
}

/**
 * Attempts one send via `transport`, returning the updated queue item.
 * Never throws — a transport failure is recorded on the item (RETRYING,
 * or FAILED once `maxAttempts` is reached) rather than propagated, so a
 * caller can drain a queue in a loop without per-item try/catch.
 */
export async function sendWithRetry(
  transport: Transport,
  item: QueuedMessage,
  now: Date = new Date(),
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<QueuedMessage> {
  try {
    await transport.send(item.message);
    return recordSuccess(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return recordFailure(item, message, now, maxAttempts);
  }
}
