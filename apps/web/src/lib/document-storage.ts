/**
 * Server-only. Local-disk storage for generated documents (LIR/LS/ENV/
 * NOTOC) — Faz 15 will decide the production volume/object-store setup;
 * this is the dev/pilot-stage implementation. `pdfPath` stored on the
 * `Document` row is always the path returned here (relative to
 * DOCUMENTS_ROOT), never an absolute filesystem path.
 */

import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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

/**
 * Whether the bytes behind a `Document` row are still on disk.
 *
 * A `Document` row is insert-only, but the file store is not part of the
 * database: a wiped dev volume, or a restore that missed the document
 * directory, leaves a row whose PDF is gone. The documents page checks this
 * so it can say so up front instead of handing the crew a link that fails
 * when they click it.
 */
export async function documentExists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(DOCUMENTS_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}
