import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateUploadFiles } from "../_shared";

/**
 * Faz 5 upload flow, step 1 — validates every uploaded JSON file against
 * @tua/ahm-data's zod schemas and returns a preview (per-file ok/error +
 * a short summary). Never writes anything to disk or the database.
 *
 * This route sits under /api, which middleware.ts's matcher intentionally
 * excludes (API routes handle their own auth) — so the ADMIN check has to
 * happen here explicitly, not rely on the page-level middleware guard.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const { results, allOk } = await validateUploadFiles(formData);

  return NextResponse.json({ results, allOk });
}
