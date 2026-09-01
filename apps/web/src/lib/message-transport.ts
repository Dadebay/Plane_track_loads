/**
 * Server-only. Local-disk "transport" for outgoing SITA/email messages —
 * same dev/pilot-stage posture as document-storage.ts (Faz 15 will decide
 * the production SITA/SMTP integration). Writing succeeds deterministically
 * so LDM/CPM/MVT sends resolve to SENT in this environment; the retry/
 * backoff state machine itself (@tua/messaging's queue.ts) is exercised
 * and unit-tested independently of which Transport is plugged in.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OutgoingMessage, Transport } from "@tua/messaging";

const MESSAGES_ROOT = process.env.MESSAGES_STORAGE_PATH ?? path.join(process.cwd(), ".data", "messages");

export const localOutboxTransport: Transport = {
  async send(message: OutgoingMessage): Promise<void> {
    await mkdir(MESSAGES_ROOT, { recursive: true });
    const addressLabel = message.address.sita ?? message.address.email ?? "unknown";
    const fileName = `${Date.now()}-${message.messageType}-${addressLabel}.txt`;
    await writeFile(path.join(MESSAGES_ROOT, fileName), message.body, "utf-8");
  },
};
