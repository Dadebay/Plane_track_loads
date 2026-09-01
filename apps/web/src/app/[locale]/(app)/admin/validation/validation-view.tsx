"use client";

import { useTranslations } from "next-intl";
import { PageHeader, DataTable, StatusBadge, type DataTableColumn, type BadgeTone } from "@tua/ui";
import type { Classification, DiffReportSummary, ScenarioStatus } from "@tua/compare";

export interface ScenarioRow {
  id: string;
  name: string;
  description: string;
  status: ScenarioStatus;
  summary: DiffReportSummary | null;
}

export interface FieldDiffRow {
  field: string;
  label: string;
  aerometaValue: string | null;
  ourValue: string | null;
  difference: string | null;
  classification: Classification;
  knownIssueRef: string | null;
  note: string | null;
}

const CLASSIFICATION_TONE: Record<Classification, BadgeTone> = {
  MATCH: "success",
  OUR_FIX: "info",
  INVESTIGATE: "warning",
};

const SCENARIO_STATUS_TONE: Record<ScenarioStatus, BadgeTone> = {
  REFERENCE_AVAILABLE: "success",
  PENDING_REFERENCE: "neutral",
};

export function ValidationView({
  coverage,
  scenarioRows,
  referenceScenarioName,
  fieldRows,
}: {
  coverage: { total: number; withReference: number; pending: number };
  scenarioRows: ScenarioRow[];
  referenceScenarioName: string | null;
  fieldRows: FieldDiffRow[];
}) {
  const t = useTranslations("admin.validation");

  const scenarioColumns: DataTableColumn<ScenarioRow>[] = [
    { key: "name", header: t("scenario"), render: (r) => r.name },
    { key: "description", header: t("description"), render: (r) => r.description, hideOnCard: true },
    {
      key: "status",
      header: t("status"),
      render: (r) => (
        <StatusBadge tone={SCENARIO_STATUS_TONE[r.status]}>
          {r.status === "REFERENCE_AVAILABLE" ? t("statusAvailable") : t("statusPending")}
        </StatusBadge>
      ),
    },
    {
      key: "summary",
      header: t("summaryColumn"),
      render: (r) =>
        r.summary
          ? t("summaryValue", { match: r.summary.match, ourFix: r.summary.ourFix, investigate: r.summary.investigate })
          : "—",
    },
  ];

  const fieldColumns: DataTableColumn<FieldDiffRow>[] = [
    { key: "label", header: t("field"), render: (r) => r.label },
    { key: "aerometaValue", header: t("aerometa"), render: (r) => r.aerometaValue ?? "—" },
    { key: "ourValue", header: t("ours"), render: (r) => r.ourValue ?? "—" },
    { key: "difference", header: t("difference"), render: (r) => r.difference ?? "—", hideOnCard: true },
    {
      key: "classification",
      header: t("classification"),
      render: (r) => (
        <StatusBadge tone={CLASSIFICATION_TONE[r.classification]}>
          {t(`classification${r.classification}` as never)}
          {r.knownIssueRef ? ` (${r.knownIssueRef})` : ""}
        </StatusBadge>
      ),
    },
    { key: "note", header: t("note"), render: (r) => r.note ?? "—" },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={t("title")} />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <p className="text-sm text-fg-muted">
          {t("coverage", { withReference: coverage.withReference, total: coverage.total })}
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg">{t("scenariosHeading")}</h2>
          <DataTable columns={scenarioColumns} rows={scenarioRows} rowKey={(r) => r.id} emptyState={t("noScenarios")} />
        </section>

        {referenceScenarioName ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-fg">{t("detailHeading", { scenario: referenceScenarioName })}</h2>
            <DataTable columns={fieldColumns} rows={fieldRows} rowKey={(r) => r.field} emptyState={t("noFields")} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
