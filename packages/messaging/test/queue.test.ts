import { describe, expect, it } from "vitest";
import {
  computeBackoffMs,
  createQueuedMessage,
  isDue,
  sendWithRetry,
  type OutgoingMessage,
  type Transport,
} from "../src/queue";

const message: OutgoingMessage = {
  messageType: "LDM",
  address: { sita: "ASBDBT5" },
  body: "LDM\r\nT5692/11AUG.SGNASB",
};

function alwaysSucceeds(): Transport {
  return { send: async () => {} };
}

function alwaysFails(errorMessage = "connection refused"): Transport {
  return {
    send: async () => {
      throw new Error(errorMessage);
    },
  };
}

describe("createQueuedMessage", () => {
  it("starts PENDING, due immediately, zero attempts", () => {
    const now = new Date("2026-08-11T22:00:00Z");
    const item = createQueuedMessage("msg-1", message, now);
    expect(item.status).toBe("PENDING");
    expect(item.attempts).toBe(0);
    expect(isDue(item, now)).toBe(true);
  });
});

describe("computeBackoffMs", () => {
  it("doubles each attempt and caps at 30 minutes", () => {
    expect(computeBackoffMs(1)).toBe(30_000);
    expect(computeBackoffMs(2)).toBe(60_000);
    expect(computeBackoffMs(3)).toBe(120_000);
    expect(computeBackoffMs(20)).toBe(30 * 60_000);
  });
});

describe("sendWithRetry", () => {
  it("marks the item SENT on success", async () => {
    const now = new Date("2026-08-11T22:00:00Z");
    const item = createQueuedMessage("msg-1", message, now);
    const result = await sendWithRetry(alwaysSucceeds(), item, now);

    expect(result.status).toBe("SENT");
    expect(result.attempts).toBe(1);
    expect(result.nextAttemptAt).toBeNull();
  });

  it("moves to RETRYING with a future nextAttemptAt on failure, below maxAttempts", async () => {
    const now = new Date("2026-08-11T22:00:00Z");
    const item = createQueuedMessage("msg-1", message, now);
    const result = await sendWithRetry(alwaysFails(), item, now, 5);

    expect(result.status).toBe("RETRYING");
    expect(result.attempts).toBe(1);
    expect(result.lastError).toBe("connection refused");
    expect(new Date(result.nextAttemptAt as string).getTime()).toBeGreaterThan(now.getTime());
    expect(isDue(result, now)).toBe(false);
  });

  it("moves to FAILED once maxAttempts is reached, with no further retry scheduled", async () => {
    const now = new Date("2026-08-11T22:00:00Z");
    let item = createQueuedMessage("msg-1", message, now);
    const transport = alwaysFails();

    for (let i = 0; i < 3; i++) {
      item = await sendWithRetry(transport, item, now, 3);
    }

    expect(item.status).toBe("FAILED");
    expect(item.attempts).toBe(3);
    expect(item.nextAttemptAt).toBeNull();
  });

  it("does not throw even when the transport rejects", async () => {
    const now = new Date("2026-08-11T22:00:00Z");
    const item = createQueuedMessage("msg-1", message, now);
    await expect(sendWithRetry(alwaysFails(), item, now)).resolves.toBeDefined();
  });
});
