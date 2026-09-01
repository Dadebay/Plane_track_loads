"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";
import { DataTable, PageHeader, StatusBadge, type DataTableColumn } from "@tua/ui";
import { formatDateTime } from "@/lib/format-date";
import { generateEnv, generateLir, generateLoadsheet } from "./actions";

type DocumentType = "LIR" | "LS" | "ENV";

const GENERATE_ACTIONS = { LIR: generateLir, LS: generateLoadsheet, ENV: generateEnv } as const;

export interface LegOption {
  id: string;
  flightNo: string;
  route: string;
  date: string;
}

export interface UserOption {
  id: string;
  name: string;
}

export interface DocumentRow {
  id: string;
  type: string;
  edition: number;
  flightNo: string;
  preparedByName: string;
  checkedByName: string;
  issuedAt: string;
  superseded: boolean;
}

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function DocumentsView({
  legs,
  users,
  documents,
}: {
  legs: LegOption[];
  users: UserOption[];
  documents: DocumentRow[];
}) {
  const tNav = useTranslations("nav");
  const tGen = useTranslations("documents.generate");
  const tList = useTranslations("documents.list");
  const { data: session } = useSession();

  const [documentType, setDocumentType] = useState<DocumentType>("LIR");
  const [legId, setLegId] = useState(legs[0]?.id ?? "");
  const [checkedById, setCheckedById] = useState("");
  const [si, setSi] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<DocumentType | null>(null);

  const checkerOptions = users.filter((u) => u.id !== session?.user?.id);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await GENERATE_ACTIONS[documentType]({ legId, checkedById, specialInformation: si });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "validation");
      return;
    }
    setSuccess(documentType);
    setSi("");
  }

  const columns: DataTableColumn<DocumentRow>[] = [
    { key: "type", header: tList("type"), render: (d) => d.type },
    { key: "flight", header: tList("flight"), render: (d) => d.flightNo },
    {
      key: "edition",
      header: tList("edition"),
      render: (d) => (
        <span className="inline-flex items-center gap-2">
          {String(d.edition).padStart(2, "0")}
          {d.superseded ? <StatusBadge tone="warning">{tList("superseded")}</StatusBadge> : null}
        </span>
      ),
    },
    { key: "preparedBy", header: tList("preparedBy"), render: (d) => d.preparedByName, hideOnCard: true },
    { key: "checkedBy", header: tList("checkedBy"), render: (d) => d.checkedByName, hideOnCard: true },
    {
      key: "issuedAt",
      header: tList("issuedAt"),
      render: (d) => `${formatDateTime(new Date(d.issuedAt))} UTC`,
    },
    {
      key: "download",
      header: "",
      render: (d) => (
        <a
          href={`/api/documents/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-brand-500 hover:underline"
        >
          <FileDown className="h-4 w-4" aria-hidden="true" />
          {tList("download")}
        </a>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={tNav("flightDocument")} />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <form onSubmit={handleGenerate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-fg">{tGen("title")}</h2>
          {error ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {tGen(`errors.${error}` as never)}
            </p>
          ) : null}
          {success ? <p className="text-sm text-success">{tGen("success", { type: success })}</p> : null}

          {legs.length === 0 ? (
            <p className="text-sm text-fg-subtle">{tGen("noFinalizedPlans")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                {tGen("documentType")}
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                  className={inputClass}
                >
                  <option value="LIR">LIR</option>
                  <option value="LS">LS</option>
                  <option value="ENV">ENV</option>
                </select>
              </label>
              <label className={labelClass}>
                {tGen("leg")}
                <select required value={legId} onChange={(e) => setLegId(e.target.value)} className={inputClass}>
                  {legs.map((leg) => (
                    <option key={leg.id} value={leg.id}>
                      {leg.flightNo} · {leg.route} · {leg.date}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                {tGen("checkedBy")}
                <select required value={checkedById} onChange={(e) => setCheckedById(e.target.value)} className={inputClass}>
                  <option value="" disabled>
                    —
                  </option>
                  {checkerOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {tGen("specialInformation")}
                <textarea value={si} onChange={(e) => setSi(e.target.value)} rows={2} className={inputClass} />
              </label>
            </div>
          )}

          {legs.length > 0 ? (
            <button
              type="submit"
              disabled={saving || !checkedById}
              className="inline-flex h-11 items-center justify-center self-start rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
            >
              {saving ? tGen("generating") : tGen("generate")}
            </button>
          ) : null}
        </form>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">{tList("title")}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <DataTable columns={columns} rows={documents} rowKey={(d) => d.id} emptyState={tList("empty")} />
          </div>
        </div>
      </div>
    </div>
  );
}
