/**
 * Server-only. Local-disk storage for generated documents (LIR/LS/ENV/
 * NOTOC) — Faz 15 will decide the production volume/object-store setup;
 * this is the dev/pilot-stage implementation. `pdfPath` stored on the
 * `Document` row is always the path returned here (relative to
 * DOCUMENTS_ROOT), never an absolute filesystem path.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DOCUMENTS_ROOT = process.env.DOCUMENTS_STORAGE_PATH ?? path.join(process.cwd(), ".data", "documents");

export interface StoredDocument {
  pdfPath: string;
  sha256: string;
}

export async function storeDocument(
  type: string,
  legId: string,
  edition: number,
  buffer: Buffer,
): Promise<StoredDocument> {
  const relativePath = path.join(type, legId, `ed${String(edition).padStart(2, "0")}.pdf`);
  const absolutePath = path.join(DOCUMENTS_ROOT, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { pdfPath: relativePath, sha256 };
}

export async function readDocument(relativePath: string): Promise<Buffer> {
  return readFile(path.join(DOCUMENTS_ROOT, relativePath));
}
