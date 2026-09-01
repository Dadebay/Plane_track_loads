"use client";

import { useTranslations } from "next-intl";
import { PageHeader, DataTable, type DataTableColumn } from "@tua/ui";
import type { AhmDocument } from "@tua/db";
import type { DiffEntry } from "@tua/ahm-data";

function docLabel(d: AhmDocument): string {
  return `${d.aircraftType} — Ed.${d.edition}/Rev.${d.revision}`;
}

export function AhmDiffView({
  documents,
  beforeId,
  afterId,
  entries,
}: {
  documents: AhmDocument[];
  beforeId?: string;
  afterId?: string;
  entries: DiffEntry[] | null;
}) {
  const t = useTranslations("admin.ahm");

  const columns: DataTableColumn<DiffEntry>[] = [
    { key: "path", header: t("diff.field"), render: (e) => <code className="text-xs">{e.path}</code> },
    {
      key: "type",
      header: t("diff.changeType"),
      render: (e) =>
        e.type === "added" ? t("diff.addedLabel") : e.type === "removed" ? t("diff.removedLabel") : t("diff.changedLabel"),
    },
    { key: "before", header: t("diff.before"), render: (e) => (e.before === undefined ? "—" : String(e.before)) },
    { key: "after", header: t("diff.after"), render: (e) => (e.after === undefined ? "—" : String(e.after)) },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={t("diff.title")} />

      <form method="get" className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:p-6">
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted sm:w-64">
          {t("diff.before")}
          <select
            name="before"
            defaultValue={beforeId}
            className="h-10 rounded-md border border-border bg-bg px-2 text-sm text-fg"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {docLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted sm:w-64">
          {t("diff.after")}
          <select
            name="after"
            defaultValue={afterId}
            className="h-10 rounded-md border border-border bg-bg px-2 text-sm text-fg"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {docLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md bg-brand-500 px-4 text-sm font-medium text-fg-on-brand">
          {t("diff.run")}
        </button>
      </form>

      {entries !== null ? (
        entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-fg-subtle sm:px-6">{t("diff.noChanges")}</p>
        ) : (
          <DataTable columns={columns} rows={entries} rowKey={(e) => e.path} emptyState={t("diff.noChanges")} />
        )
      ) : null}
    </div>
  );
}
