"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FileDown, History, Info, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DataTable,
  FilterField,
  FilterPanel,
  Pagination,
  StatusBadge,
  type DataTableColumn,
} from "@tua/ui";
import { PageHeader } from "@/components/page-header";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { UldListFilters, UldRow } from "@/lib/uld-queries";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { bulkUpdateUldStatus, deleteUld } from "./actions";
import { UldFormModal, type EditingUld, type StationOption, type UldTypeInfo } from "./uld-form-modal";
import { UldMovementModal, type FlightOption } from "./uld-movement-modal";
import { UldScanButton } from "./uld-scan-button";

const ULD_STATUSES = ["AVAILABLE", "ASSIGNED", "DAMAGED", "LOST"] as const;
const ULD_CONDITIONS = ["SERVICEABLE", "DAMAGED", "UNSERVICEABLE"] as const;

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  AVAILABLE: "success",
  ASSIGNED: "info",
  DAMAGED: "warning",
  LOST: "danger",
};

const selectClass = "h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9";

export function UldListView({
  rows,
  total,
  filters,
  active,
  stations,
  typeCodes,
  flights,
  uldTypeInfo,
}: {
  rows: UldRow[];
  total: number;
  filters: UldListFilters;
  active: boolean;
  stations: StationOption[];
  typeCodes: string[];
  flights: FlightOption[];
  uldTypeInfo: UldTypeInfo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("uld");
  const tList = useTranslations("uld.list");
  const tStatus = useTranslations("uld.statusValue");
  const tCondition = useTranslations("uld.conditionValue");
  const tNaming = useTranslations("uld.naming");
  const tCommon = useTranslations("common");

  const [pending, setPending] = useState({
    code: filters.code ?? "",
    serial: filters.serial ?? "",
    typeCode: filters.typeCode ?? "",
    ownerCode: filters.ownerCode ?? "",
    assignedStation: filters.assignedStation ?? "",
    currentStation: filters.currentStation ?? "",
    status: filters.status ?? "",
    condition: filters.condition ?? "",
    baseplateCode: filters.baseplateCode ?? "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<(typeof ULD_STATUSES)[number]>("AVAILABLE");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingUld | null>(null);
  const [namingOpen, setNamingOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [movementUld, setMovementUld] = useState<{ id: string; code: string } | null>(null);

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyFilters() {
    navigateWithParams((params) => {
      for (const [key, value] of Object.entries(pending)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.set("page", "1");
    });
  }

  function handleSort(key: string) {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    navigateWithParams((params) => {
      params.set("sort", key);
      params.set("dir", dir);
    });
  }

  function handlePageChange(page: number) {
    navigateWithParams((params) => params.set("page", String(page)));
  }

  function handlePageSizeChange(size: number) {
    navigateWithParams((params) => {
      params.set("pageSize", String(size));
      params.set("page", "1");
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  /** Edit and delete need exactly one ULD; several selected is a bulk
   * operation and a different action. */
  const selectedRow = selected.size === 1 ? (rows.find((r) => selected.has(r.id)) ?? null) : null;

  async function handleDelete() {
    if (!selectedRow) return;
    setDeleteError(null);
    const result = await deleteUld(selectedRow.id);
    if (!result.ok) {
      setDeleteError(result.error === "uldInUse" ? t("deleteInUse") : (result.error ?? "error"));
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: UldRow) {
    setEditing({
      id: row.id,
      code: row.code,
      typeCode: row.typeCode,
      serial: row.serial ?? "",
      ownerCode: row.ownerCode ?? "",
      status: row.status,
      condition: row.condition,
      baseplateCode: row.baseplateCode ?? "",
      assignedStationId: row.assignedStationId ?? "",
      currentStationId: row.currentStationId ?? "",
    });
    setFormOpen(true);
  }

  function handleSaved() {
    setFormOpen(false);
    router.refresh();
  }

  async function applyBulkStatus() {
    if (selected.size === 0) return;
    await bulkUpdateUldStatus([...selected], bulkStatus);
    setSelected(new Set());
    router.refresh();
  }

  function handleScan(code: string) {
    setPending((p) => ({ ...p, code }));
    navigateWithParams((params) => {
      params.set("code", code);
      params.set("page", "1");
    });
  }

  const columns: DataTableColumn<UldRow>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={rows.length > 0 && selected.size === rows.length}
          onChange={toggleSelectAll}
          aria-label={tCommon("actions")}
        />
      ),
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} />
        </span>
      ),
    },
    { key: "baseplateCode", header: t("baseplateCode"), sortable: true, render: (r) => r.baseplateCode ?? "—", hideOnCard: true },
    { key: "code", header: t("code"), sortable: true, render: (r) => r.code },
    { key: "typeCode", header: t("typeCode"), sortable: true, render: (r) => r.typeCode },
    { key: "serial", header: t("serialNumber"), sortable: true, render: (r) => r.serial ?? "—", hideOnCard: true },
    { key: "ownerCode", header: t("ownerCode"), sortable: true, render: (r) => r.ownerCode ?? "—", hideOnCard: true },
    {
      key: "assignedStation",
      header: t("assignedStation"),
      sortable: true,
      render: (r) => r.assignedStation?.iata ?? "—",
      hideOnCard: true,
    },
    { key: "currentStation", header: t("currentStation"), sortable: true, render: (r) => r.currentStation?.iata ?? "—" },
    {
      key: "status",
      header: tCommon("status"),
      sortable: true,
      render: (r) => <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{tStatus(r.status.toLowerCase() as never)}</StatusBadge>,
    },
    { key: "flight", header: tList("flight"), render: (r) => r.currentFlight?.flightNo ?? "—" },
    {
      key: "condition",
      header: t("condition"),
      sortable: true,
      render: (r) => tCondition(r.condition.toLowerCase() as never),
      hideOnCard: true,
    },
    {
      key: "history",
      header: tCommon("actions"),
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMovementUld({ id: r.id, code: r.code });
          }}
          aria-label={t("movement.title" as never)}
          className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted"
        >
          <History className="h-4 w-4" aria-hidden="true" />
        </button>
      ),
      hideOnCard: true,
    },
  ];

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <UldScanButton onScan={handleScan} />
            <button
              type="button"
              onClick={() => setNamingOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
              {t("namingConvention")}
            </button>
            <a
              href="/api/uld/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {tList("exportPdf")}
            </a>
            {/* Edit and delete act on exactly one selected ULD — the same
                rule the crew's current stock screen uses, so a bulk action
                can never be mistaken for a single-row one. */}
            <button
              type="button"
              disabled={selectedRow === null}
              onClick={() => selectedRow && openEdit(selectedRow)}
              title={selectedRow ? tCommon("edit") : t("selectOneFirst")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {tCommon("edit")}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-medium text-fg-on-brand"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addUld")}
            </button>
            <button
              type="button"
              disabled={selectedRow === null}
              onClick={handleDelete}
              title={selectedRow ? tCommon("delete") : t("selectOneFirst")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-danger px-3 text-sm font-medium text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:border-border disabled:text-fg-subtle disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {tCommon("delete")}
            </button>
          </>
        }
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {deleteError ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {deleteError}
          </p>
        ) : null}
        <FilterPanel
          trailing={
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex h-11 items-center rounded-md bg-brand-500 px-4 text-sm font-medium text-fg-on-brand sm:h-9"
            >
              {tCommon("filter")}
            </button>
          }
        >
          <FilterField label={t("code")}>
            <input
              value={pending.code}
              onChange={(e) => setPending((p) => ({ ...p, code: e.target.value }))}
              placeholder="PMC12345TU"
              className={selectClass}
            />
          </FilterField>
          <FilterField label={t("serialNumber")}>
            <input
              value={pending.serial}
              onChange={(e) => setPending((p) => ({ ...p, serial: e.target.value }))}
              className={selectClass}
            />
          </FilterField>
          <FilterField label={t("typeCode")}>
            <select
              value={pending.typeCode}
              onChange={(e) => setPending((p) => ({ ...p, typeCode: e.target.value }))}
              className={selectClass}
            >
              <option value="">{tList("allTypes")}</option>
              {typeCodes.map((tc) => (
                <option key={tc} value={tc}>
                  {tc}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("ownerCode")}>
            <input
              value={pending.ownerCode}
              onChange={(e) => setPending((p) => ({ ...p, ownerCode: e.target.value }))}
              className={selectClass}
            />
          </FilterField>
          <FilterField label={t("assignedStation")}>
            <select
              value={pending.assignedStation}
              onChange={(e) => setPending((p) => ({ ...p, assignedStation: e.target.value }))}
              className={selectClass}
            >
              <option value="">{tList("allStations")}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.iata}>
                  {s.iata} — {s.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("currentStation")}>
            <select
              value={pending.currentStation}
              onChange={(e) => setPending((p) => ({ ...p, currentStation: e.target.value }))}
              className={selectClass}
            >
              <option value="">{tList("allStations")}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.iata}>
                  {s.iata} — {s.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={tCommon("status")}>
            <select
              value={pending.status}
              onChange={(e) => setPending((p) => ({ ...p, status: e.target.value }))}
              className={selectClass}
            >
              <option value="">{tList("allStatuses")}</option>
              {ULD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tStatus(s.toLowerCase() as never)}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("condition")}>
            <select
              value={pending.condition}
              onChange={(e) => setPending((p) => ({ ...p, condition: e.target.value }))}
              className={selectClass}
            >
              <option value="">{tList("allConditions")}</option>
              {ULD_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {tCondition(c.toLowerCase() as never)}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("baseplateCode")}>
            <input
              value={pending.baseplateCode}
              onChange={(e) => setPending((p) => ({ ...p, baseplateCode: e.target.value }))}
              className={selectClass}
            />
          </FilterField>
        </FilterPanel>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-subtle p-3">
            <span className="text-sm font-medium text-fg">{tList("selected", { count: selected.size })}</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as (typeof ULD_STATUSES)[number])}
              className={selectClass}
            >
              {ULD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tStatus(s.toLowerCase() as never)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulkStatus}
              className="inline-flex h-9 items-center rounded-md bg-brand-500 px-3 text-sm font-medium text-fg-on-brand"
            >
              {tList("setStatus")}
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={openEdit}
            emptyState={active ? tCommon("noResults") : tCommon("useFiltersAbove")}
            sortKey={filters.sort}
            sortDirection={filters.dir}
            onSort={handleSort}
          />
          {active ? (
            <Pagination
              page={filters.page ?? 1}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              itemsPerPageLabel={tCommon("itemsPerPage")}
              totalLabel={tCommon("total")}
              pageLabel={(current, totalPages) => tCommon("page", { current, total: totalPages })}
            />
          ) : null}
        </div>
      </div>

      {namingOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setNamingOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("namingConvention")}
            className="w-full max-w-md rounded-lg border border-border bg-bg-subtle p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold text-fg">{t("namingConvention")}</h2>
            {/* The same rule lib/uld-code.ts enforces — stated once, so the
                help text cannot drift from the validation. */}
            <p className="mb-3 text-sm text-fg-muted">{tNaming("description")}</p>
            <p className="mb-4 font-mono text-base text-fg">PMC 12345 TU</p>
            <button
              type="button"
              onClick={() => setNamingOpen(false)}
              className="h-11 w-full rounded-md border border-border text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
            >
              {tCommon("close")}
            </button>
          </div>
        </div>
      ) : null}

      <UldFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        stations={stations}
        editing={editing}
        uldTypeInfo={uldTypeInfo}
      />
      <UldMovementModal
        open={movementUld !== null}
        onClose={() => setMovementUld(null)}
        onSaved={() => router.refresh()}
        uld={movementUld}
        stations={stations}
        flights={flights}
      />
    </div>
  );
}
