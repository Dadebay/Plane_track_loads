"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Download, Eye, Plus, X } from "lucide-react";
import { DataTable, Pagination, StatusBadge, type DataTableColumn, type FlightStatus } from "@tua/ui";
import { PageHeader } from "@/components/page-header";
import { FlightFilters, type StationOption } from "@/components/flight-filters";
import { usePathname, useRouter } from "@/i18n/navigation";
import { formatDateTimePartsInZone } from "@/lib/format-date";
import { documentFilename } from "@/lib/document-filename";
import type { FlightLegRow, FlightListFilters } from "@/lib/flight-queries";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { generateEdp, generateEnv, generateLir, generateLoadsheet } from "./actions";

/**
 * Flight documents.
 *
 * One row per leg, and on the right the four documents that leg can carry.
 * Each generated document offers the same bytes twice: the eye opens it in
 * the browser, the arrow saves it under its operational filename
 * (LS_T53431_10092026_ED04.pdf) — that name is what the crew files and
 * searches by, so it is produced by one shared helper, not by the browser.
 */

/** Printed in the order the crew works: plan, instruct, report, check. */
const DOCUMENT_TYPES = ["LS", "EDP", "LIR", "ENV"] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

const GENERATE_ACTIONS: Record<DocumentType, (input: { legId: string; checkedById: string; specialInformation?: string }) => Promise<{ ok: boolean; error?: string }>> = {
  LS: generateLoadsheet,
  EDP: generateEdp,
  LIR: generateLir,
  ENV: generateEnv,
};

export interface DocumentRef {
  id: string;
  edition: number;
  issuedAt: string;
  /** False when the stored PDF is gone — the row stays (insert-only), but
   * there is nothing to open. */
  available: boolean;
}

/** Current edition of each type held for one leg, keyed by DocumentType. */
export type LegDocuments = Partial<Record<string, DocumentRef>>;

export interface UserOption {
  id: string;
  name: string;
}

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function DocumentsView({
  rows,
  total,
  filters,
  documentsByLegId,
  finalizedLegIds,
  users,
  stations,
  serviceTypes,
  flightNumberPrefixes,
  registrations,
}: {
  rows: FlightLegRow[];
  total: number;
  filters: FlightListFilters;
  documentsByLegId: Record<string, LegDocuments>;
  finalizedLegIds: string[];
  users: UserOption[];
  stations: StationOption[];
  serviceTypes: string[];
  flightNumberPrefixes: string[];
  registrations: string[];
}) {
  const tNav = useTranslations("nav");
  const tList = useTranslations("flights.list");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("flights.status");
  const tDocs = useTranslations("documents.list");
  const tGen = useTranslations("documents.generate");
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const finalized = new Set(finalizedLegIds);
  const [generating, setGenerating] = useState<{ leg: FlightLegRow; type: DocumentType } | null>(null);

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSort(key: string) {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    navigateWithParams((params) => {
      params.set("sort", key);
      params.set("dir", dir);
    });
  }

  /** Every timestamp in its own station's zone, labelled — a departure and
   * an arrival are in different zones, so one page-wide switch could only
   * ever be right for half the columns. */
  function formatTime(date: Date | null, timezone: string) {
    if (!date) return <span className="text-fg-subtle">—</span>;
    const parts = formatDateTimePartsInZone(new Date(date), timezone);
    return (
      <span className="flex flex-col leading-tight">
        <span>{parts.date}</span>
        <span className="text-fg-muted">
          {parts.time} ({tCommon("local")})
        </span>
      </span>
    );
  }

  function DocumentCell({ leg }: { leg: FlightLegRow }) {
    const held = documentsByLegId[leg.id] ?? {};
    return (
      <span className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()} role="presentation">
        {DOCUMENT_TYPES.map((type) => {
          const doc = held[type];
          const filename = doc
            ? documentFilename({
                type,
                flightNo: leg.flight.flightNo,
                departure: new Date(leg.stdDep),
                timeZone: leg.fromStation.timezone,
                edition: doc.edition,
              })
            : null;
          return (
            <span key={type} className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-xs font-semibold text-fg">{type}</span>
              {doc && filename && !doc.available ? (
                // The edition exists but its file does not. Say so where the
                // links would be, and leave the new-edition button available
                // so the crew can produce a replacement.
                <>
                  <span className="w-9 shrink-0 text-xs tabular-nums text-fg-subtle">
                    ED{String(doc.edition).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-danger" title={tDocs("fileMissingHint", { name: filename })}>
                    {tDocs("fileMissing")}
                  </span>
                  <button
                    type="button"
                    disabled={!finalized.has(leg.id)}
                    onClick={() => setGenerating({ leg, type })}
                    aria-label={tDocs("newEdition", { type, flightNo: leg.flight.flightNo })}
                    title={finalized.has(leg.id) ? tDocs("newEdition", { type, flightNo: leg.flight.flightNo }) : tGen("errors.loadPlanNotFinalized")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              ) : doc && filename ? (
                <>
                  <span className="w-9 shrink-0 text-xs tabular-nums text-fg-subtle">
                    ED{String(doc.edition).padStart(2, "0")}
                  </span>
                  <a
                    href={`/api/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tDocs("preview", { name: filename })}
                    title={filename}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <a
                    href={`/api/documents/${doc.id}?download=1`}
                    aria-label={tDocs("downloadNamed", { name: filename })}
                    title={filename}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>
                  {/* A document is never edited: a changed plan is a new
                      edition (CLAUDE.md rule #5), so the action stays
                      available after the first one is issued. */}
                  <button
                    type="button"
                    disabled={!finalized.has(leg.id)}
                    onClick={() => setGenerating({ leg, type })}
                    aria-label={tDocs("newEdition", { type, flightNo: leg.flight.flightNo })}
                    title={finalized.has(leg.id) ? tDocs("newEdition", { type, flightNo: leg.flight.flightNo }) : tGen("errors.loadPlanNotFinalized")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!finalized.has(leg.id)}
                  onClick={() => setGenerating({ leg, type })}
                  title={finalized.has(leg.id) ? tGen("generate") : tGen("errors.loadPlanNotFinalized")}
                  aria-label={tDocs("generateNamed", { type, flightNo: leg.flight.flightNo })}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-2 text-xs text-fg-muted hover:bg-bg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {tGen("generate")}
                </button>
              )}
            </span>
          );
        })}
      </span>
    );
  }

  const columns: DataTableColumn<FlightLegRow>[] = [
    {
      key: "status",
      header: tCommon("status"),
      sortable: true,
      render: (r) => {
        const status = r.flight.status.toLowerCase() as FlightStatus;
        return <StatusBadge status={status}>{tStatus(status)}</StatusBadge>;
      },
    },
    { key: "stdDep", header: tList("schTimeDep"), sortable: true, render: (r) => formatTime(r.stdDep, r.fromStation.timezone) },
    { key: "staArr", header: tList("schTimeArr"), render: (r) => formatTime(r.staArr, r.toStation.timezone), hideOnCard: true },
    {
      key: "route",
      header: tList("routes"),
      render: (r) => `${r.fromStation.iata}${r.via ? `-${r.via}` : ""}-${r.toStation.iata}`,
    },
    { key: "flightNo", header: tList("flightNoShort"), sortable: true, render: (r) => r.flight.flightNo },
    { key: "reg", header: tList("registrationShort"), render: (r) => r.flight.aircraft.registration, hideOnCard: true },
    { key: "svcType", header: tList("serviceTypeShort"), render: (r) => r.flight.serviceType, hideOnCard: true },
    { key: "document", header: tDocs("document"), render: (r) => <DocumentCell leg={r} /> },
  ];

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col">
      <PageHeader title={tNav("flightDocument")} />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <FlightFilters
          filters={filters}
          stations={stations}
          serviceTypes={serviceTypes}
          flightNumberPrefixes={flightNumberPrefixes}
          registrations={registrations}
        />

        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyState={tCommon("noResults")}
            sortKey={filters.sort}
            sortDirection={filters.dir}
            onSort={handleSort}
          />
          <Pagination
            page={filters.page ?? 1}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={(page) => navigateWithParams((params) => params.set("page", String(page)))}
            onPageSizeChange={(size) =>
              navigateWithParams((params) => {
                params.set("pageSize", String(size));
                params.set("page", "1");
              })
            }
            itemsPerPageLabel={tCommon("itemsPerPage")}
            totalLabel={tCommon("total")}
            pageLabel={(current, totalPages) => tCommon("page", { current, total: totalPages })}
          />
        </div>
      </div>

      {generating ? (
        <GenerateModal
          leg={generating.leg}
          type={generating.type}
          users={users.filter((u) => u.id !== session?.user?.id)}
          onClose={() => setGenerating(null)}
          onGenerated={() => {
            setGenerating(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Generating is a two-person act: whoever is signed in prepares the document
 * and someone else checks it (CLAUDE.md rule #7), so the checker is chosen
 * here and the signed-in user never appears in the list.
 */
function GenerateModal({
  leg,
  type,
  users,
  onClose,
  onGenerated,
}: {
  leg: FlightLegRow;
  type: DocumentType;
  users: UserOption[];
  onClose: () => void;
  onGenerated: () => void;
}) {
  const tGen = useTranslations("documents.generate");
  const tCommon = useTranslations("common");
  const [checkedById, setCheckedById] = useState("");
  const [si, setSi] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await GENERATE_ACTIONS[type]({ legId: leg.id, checkedById, specialInformation: si });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "validation");
      return;
    }
    onGenerated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={tGen("title")}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-bg-subtle shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">
            {type} · {leg.flight.flightNo}
          </h2>
          <button type="button" onClick={onClose} aria-label={tCommon("close")} className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {error ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {tGen(`errors.${error}` as never)}
            </p>
          ) : null}
          <label className={labelClass}>
            {tGen("checkedBy")}
            <select required value={checkedById} onChange={(e) => setCheckedById(e.target.value)} className={inputClass}>
              <option value="" disabled>
                —
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {tGen("specialInformation")}
            <textarea value={si} onChange={(e) => setSi(e.target.value)} rows={2} className={inputClass} />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-fg-muted hover:bg-bg-muted">
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || !checkedById}
            className="inline-flex h-9 items-center rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50"
          >
            {saving ? tGen("generating") : tGen("generate")}
          </button>
        </div>
      </form>
    </div>
  );
}
