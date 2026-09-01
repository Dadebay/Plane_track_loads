import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { auditedDb, db } from "@tua/db";
import { REQUIRED_FILES, validateUploadFiles } from "../_shared";

/**
 * Faz 5 upload flow, step 2 — re-validates (never trust a client-supplied
 * "it already passed validation" claim) and, only if every file is valid,
 * persists the new AHM revision: writes the JSON files into
 * @tua/ahm-data's data directory (the same directory `loadAhmData` reads
 * from — see @tua/ahm-data/src/schema.ts's `dataRoot()`) and creates the
 * AhmDocument row.
 *
 * Path resolution note: this assumes apps/web and packages/ahm-data sit in
 * the same pnpm workspace checkout (true for this monorepo's current
 * single-server dev/deploy model). A multi-instance or immutable-artifact
 * production deployment would need a real writable data store instead —
 * see IMPLEMENTATION_PLAN.md Faz 15 (Dağıtım ve Operasyon), not solved
 * here.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();

  const aircraftType = String(formData.get("aircraftType") ?? "").trim();
  const editionRaw = String(formData.get("edition") ?? "");
  const revisionRaw = String(formData.get("revision") ?? "");
  const effectiveDateRaw = String(formData.get("effectiveDate") ?? "");
  const approvedBy = String(formData.get("approvedBy") ?? "").trim();

  const edition = Number(editionRaw);
  const revision = Number(revisionRaw);

  if (!aircraftType || !Number.isInteger(edition) || !Number.isInteger(revision) || !effectiveDateRaw || !approvedBy) {
    return NextResponse.json({ error: "invalidMetadata" }, { status: 400 });
  }

  const existing = await db.ahmDocument.findUnique({
    where: { aircraftType_edition_revision: { aircraftType, edition, revision } },
  });
  if (existing) {
    return NextResponse.json({ error: "alreadyExists" }, { status: 409 });
  }

  const { results, allOk, parsedByKey } = await validateUploadFiles(formData);
  if (!allOk) {
    return NextResponse.json({ error: "validationFailed", results }, { status: 422 });
  }

  const dataPath = `${aircraftType}/ed${edition}-rev${revision}`;
  const targetDir = path.join(process.cwd(), "..", "..", "packages", "ahm-data", "data", aircraftType, `ed${edition}-rev${revision}`);
  await mkdir(targetDir, { recursive: true });

  for (const spec of REQUIRED_FILES) {
    const parsed = parsedByKey.get(spec.key);
    const json = JSON.stringify(parsed, null, 2) + "\n";
    await writeFile(path.join(targetDir, spec.filename), json, "utf-8");
  }

  const scoped = auditedDb({ actorId: session.user.id, ip: request.headers.get("x-forwarded-for") ?? undefined });
  const doc = await scoped.ahmDocument.create({
    data: {
      aircraftType,
      edition,
      revision,
      effectiveDate: new Date(effectiveDateRaw),
      dataPath,
      approvedBy,
    },
  });

  return NextResponse.json({ ok: true, id: doc.id });
}
