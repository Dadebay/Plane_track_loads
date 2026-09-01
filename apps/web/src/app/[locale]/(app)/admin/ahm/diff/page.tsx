import { db } from "@tua/db";
import { diffAhmData, loadAhmData } from "@tua/ahm-data";
import { AhmDiffView } from "./ahm-diff-view";
import type { DiffEntry } from "@tua/ahm-data";

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
