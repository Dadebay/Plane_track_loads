"use client";

import { useLocale, useTranslations } from "next-intl";
import { PageHeader, DataTable, type DataTableColumn } from "@tua/ui";
import type { AhmDataSet } from "@tua/ahm-data";
import type { AhmDocument } from "@tua/db";
import { Link } from "@/i18n/navigation";

function KeyValueTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border">
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-fg-muted">
                {k}
              </th>
              <td className="px-3 py-2 text-fg">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border">
      <h2 className="px-4 py-3 text-sm font-semibold text-fg sm:px-6">{title}</h2>
      <div className="pb-4">{children}</div>
    </section>
  );
}

export function AhmDetailView({ doc, data }: { doc: AhmDocument; data: AhmDataSet }) {
  const t = useTranslations("admin.ahm");
  const locale = useLocale();

  const positionColumns: DataTableColumn<(typeof data.positions.positions)[number]>[] = [
    { key: "code", header: "Code", render: (p) => p.code },
    { key: "deck", header: "Deck", render: (p) => p.deck },
    { key: "uldType", header: "ULD type", render: (p) => p.uldType },
    { key: "maxGross", header: "Max gross", render: (p) => p.maxGross },
    { key: "indexPerKg", header: "Index/kg", render: (p) => p.indexPerKg },
  ];

  const fuelRows = Object.entries(data.fuelIndex).flatMap(([density, rows]) =>
    rows.map((row) => ({ density, ...row })),
  );
  const fuelColumns: DataTableColumn<(typeof fuelRows)[number]>[] = [
    { key: "density", header: "Density", render: (r) => r.density },
    { key: "fuelWeight", header: "Fuel weight", render: (r) => r.fuelWeight },
    { key: "index", header: "Index", render: (r) => r.index },
  ];

  const dowDoiRows = Object.entries(data.dowDoiMatrix)
    .filter(([key]) => key !== "notes" && key !== "source")
    .flatMap(([registration, cells]) =>
      (cells as { cockpitCrew: number; courierCrew: number; dow: string; doi: string }[]).map((c) => ({
        registration,
        ...c,
      })),
    );
  const dowDoiColumns: DataTableColumn<(typeof dowDoiRows)[number]>[] = [
    { key: "registration", header: "Registration", render: (r) => r.registration },
    { key: "cockpitCrew", header: "Cockpit", render: (r) => r.cockpitCrew },
    { key: "courierCrew", header: "Courier", render: (r) => r.courierCrew },
    { key: "dow", header: "DOW", render: (r) => r.dow },
    { key: "doi", header: "DOI", render: (r) => r.doi },
  ];

  const cgColumns: DataTableColumn<{ weight: string; index: string }>[] = [
    { key: "weight", header: "Weight", render: (r) => r.weight },
    { key: "index", header: "Index", render: (r) => r.index },
  ];

  const compartmentColumns: DataTableColumn<(typeof data.compartments.compartments)[number]>[] = [
    { key: "number", header: "No", render: (c) => c.number },
    { key: "description", header: "Description", render: (c) => c.description },
    { key: "maxGrossPair", header: "Max gross (pair)", render: (c) => c.maxGrossPair },
    { key: "lirSubLimit", header: "LIR sub-limit", render: (c) => c.lirSubLimit },
    { key: "indexPerKg", header: "Index/kg", render: (c) => c.indexPerKg },
  ];

  const zoneColumns: DataTableColumn<(typeof data.combinedLoad.zones)[number]>[] = [
    { key: "zone", header: "Zone", render: (z) => z.zone },
    { key: "group", header: "Group", render: (z) => z.group },
    { key: "hArm", header: "H-arm", render: (z) => z.hArm ?? "—" },
    {
      key: "limits",
      header: "Limits (band: kg)",
      render: (z) => (z.limits ? Object.entries(z.limits).map(([b, v]) => `${b}: ${v}`).join(" · ") : "—"),
    },
  ];

  const zoneMappingColumns: DataTableColumn<(typeof data.zoneMapping.longPalletDistribution)[number]>[] = [
    { key: "position", header: "Position", render: (p) => p.position },
    {
      key: "distribution",
      header: "Distribution",
      render: (p) => p.distribution.map((d) => `${d.zone}×${d.factor}`).join(" · "),
    },
  ];

  const uldTypeColumns: DataTableColumn<(typeof data.uldTypes.types)[number]>[] = [
    { key: "typeCode", header: "Type", render: (u) => u.typeCode },
    { key: "tareWeight", header: "Tare", render: (u) => u.tareWeight },
    { key: "grossWeight", header: "Gross", render: (u) => u.grossWeight },
    { key: "volume", header: "Volume", render: (u) => u.volume },
    { key: "deck", header: "Deck", render: (u) => u.deck },
  ];

  const courierColumns: DataTableColumn<(typeof data.crewIndex.courier)[number]>[] = [
    { key: "location", header: "Location", render: (c) => c.location },
    { key: "maxSeats", header: "Max seats", render: (c) => c.maxSeats },
    { key: "armFromRefSta", header: "Arm", render: (c) => c.armFromRefSta },
    { key: "indexPerKg", header: "Index/kg", render: (c) => c.indexPerKg },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`${data.aircraft.aircraftType} — Ed.${doc.edition}/Rev.${doc.revision}`}
        actions={
          <Link
            href="/admin/ahm"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
          >
            {t("detail.back")}
          </Link>
        }
      />

      <Section title={t("detail.sections.aircraft")}>
        <KeyValueTable
          rows={[
            [t("list.effectiveDate"), new Intl.DateTimeFormat(locale).format(new Date(doc.effectiveDate))],
            [t("list.approvedBy"), doc.approvedBy],
            ["MTW", data.aircraft.weightLimits.mtw],
            ["MTOW", data.aircraft.weightLimits.mtow],
            ["MLW", data.aircraft.weightLimits.mlw],
            ["MZFW", data.aircraft.weightLimits.mzfw],
            ["MIN", data.aircraft.weightLimits.min],
          ]}
        />
        <DataTable
          columns={[
            { key: "registration", header: "Registration", render: (r) => r.registration },
            { key: "bew", header: "BEW", render: (r) => r.bew },
            { key: "bewCgMac", header: "BEW CG %MAC", render: (r) => r.bewCgMac },
            { key: "bewIndex", header: "BEW index", render: (r) => r.bewIndex },
          ]}
          rows={data.aircraft.registrations}
          rowKey={(r) => r.registration}
          emptyState="—"
        />
      </Section>

      <Section title={t("detail.sections.indexFormula")}>
        <KeyValueTable
          rows={[
            ["Ref.Sta", data.indexFormula.refSta],
            ["K", data.indexFormula.k],
            ["C", data.indexFormula.c],
            ["MAC length", data.indexFormula.macLength],
            ["LEMAC", data.indexFormula.lemac],
            ["Ref.Sta - LEMAC", data.indexFormula.derived.refStaMinusLemac],
            ["MAC/100", data.indexFormula.derived.macOver100],
            [
              "STAB rounding",
              `${data.indexFormula.roundingRules.stab.method} (${data.indexFormula.roundingRules.stab.decimals} dp)`,
            ],
          ]}
        />
      </Section>

      <Section title={t("detail.sections.dowDoiMatrix")}>
        <DataTable
          columns={dowDoiColumns}
          rows={dowDoiRows}
          rowKey={(r) => `${r.registration}-${r.cockpitCrew}-${r.courierCrew}`}
          emptyState="—"
        />
      </Section>

      <Section title={t("detail.sections.fuelIndex")}>
        <DataTable columns={fuelColumns} rows={fuelRows} rowKey={(r) => `${r.density}-${r.fuelWeight}`} emptyState="—" />
      </Section>

      <Section title={t("detail.sections.cgLimits")}>
        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-6">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-fg-subtle">{t("detail.zfwForward")}</h3>
            <DataTable columns={cgColumns} rows={data.cgLimits.zfw.forward} rowKey={(r) => r.weight} emptyState="—" />
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-fg-subtle">{t("detail.zfwAft")}</h3>
            <DataTable columns={cgColumns} rows={data.cgLimits.zfw.aft} rowKey={(r) => r.weight} emptyState="—" />
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-fg-subtle">{t("detail.takeoffForward")}</h3>
            <DataTable columns={cgColumns} rows={data.cgLimits.takeoff.forward} rowKey={(r) => r.weight} emptyState="—" />
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-fg-subtle">{t("detail.takeoffAft")}</h3>
            <DataTable columns={cgColumns} rows={data.cgLimits.takeoff.aft} rowKey={(r) => r.weight} emptyState="—" />
          </div>
        </div>
      </Section>

      <Section title={t("detail.sections.compartments")}>
        <DataTable
          columns={compartmentColumns}
          rows={data.compartments.compartments}
          rowKey={(c) => String(c.number)}
          emptyState="—"
        />
      </Section>

      <Section title={t("detail.sections.positions")}>
        <DataTable
          columns={positionColumns}
          rows={data.positions.positions}
          rowKey={(p) => `${p.code}-${p.uldType}`}
          emptyState="—"
        />
      </Section>

      <Section title={t("detail.sections.combinedLoad")}>
        <DataTable columns={zoneColumns} rows={data.combinedLoad.zones} rowKey={(z) => z.zone} emptyState="—" />
      </Section>

      <Section title={t("detail.sections.zoneMapping")}>
        <DataTable
          columns={zoneMappingColumns}
          rows={data.zoneMapping.longPalletDistribution}
          rowKey={(p) => p.position}
          emptyState="—"
        />
      </Section>

      <Section title={t("detail.sections.uldTypes")}>
        <DataTable columns={uldTypeColumns} rows={data.uldTypes.types} rowKey={(u) => u.typeCode} emptyState="—" />
      </Section>

      <Section title={t("detail.sections.crewIndex")}>
        <KeyValueTable
          rows={[
            ["Cockpit max seats", String(data.crewIndex.cockpit.maxSeats)],
            ["Cockpit arm", data.crewIndex.cockpit.armFromRefSta],
            ["Cockpit index/kg", data.crewIndex.cockpit.indexPerKg],
          ]}
        />
        <DataTable columns={courierColumns} rows={data.crewIndex.courier} rowKey={(c) => c.location} emptyState="—" />
      </Section>
    </div>
  );
}
