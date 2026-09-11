import { db } from "@tua/db";
import { diffAhmData, loadAhmData } from "@tua/ahm-data";
import { AhmDiffView } from "./ahm-diff-view";
import type { DiffEntry } from "@tua/ahm-data";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function AhmDiffPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; after?: string }>;
}) {
  const { before, after } = await searchParams;
  const documents = await db.ahmDocument.findMany({
    orderBy: [{ aircraftType: "asc" }, { edition: "asc" }, { revision: "asc" }],
  });

  let entries: DiffEntry[] | null = null;
  if (before && after) {
    const beforeDoc = documents.find((d) => d.id === before);
    const afterDoc = documents.find((d) => d.id === after);
    if (beforeDoc && afterDoc) {
      const beforeData = loadAhmData(beforeDoc.aircraftType, beforeDoc.edition, beforeDoc.revision);
      const afterData = loadAhmData(afterDoc.aircraftType, afterDoc.edition, afterDoc.revision);
      entries = diffAhmData(beforeData, afterData);
    }
  }

  return <AhmDiffView documents={documents} beforeId={before} afterId={after} entries={entries} />;
}
