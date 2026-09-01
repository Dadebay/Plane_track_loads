"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, FileDown } from "lucide-react";
import { DataTable, PageHeader, StatusBadge, type DataTableColumn, type FlightStatus } from "@tua/ui";
import { FlightFormModal, type AircraftOption, type EditingFlight, type StationOption } from "./flight-form-modal";

export interface ScheduleFlightRow {
  id: string;
  flightNo: string;
  date: string; // yyyy-mm-dd
  serviceType: string;
  status: string;
  aircraftId: string;
  aircraftRegistration: string;
  route: string;
  legs: { fromStationId: string; toStationId: string; via: string; stdDep: string; staArr: string }[];
}

export function ScheduleView({
  flights,
  stations,
  aircraft,
}: {
  flights: ScheduleFlightRow[];
  stations: StationOption[];
  aircraft: AircraftOption[];
}) {
  const t = useTranslations("flights.schedule");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("flights.status");
  const locale = useLocale();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditingFlight | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(flight: ScheduleFlightRow) {
    setEditing({
      id: flight.id,
      flightNo: flight.flightNo,
      date: flight.date,
      serviceType: flight.serviceType,
      aircraftId: flight.aircraftId,
      status: flight.status,
      legs: flight.legs,
    });
    setModalOpen(true);
  }

  function handleSaved() {
    setModalOpen(false);
    router.refresh();
  }

  const columns: DataTableColumn<ScheduleFlightRow>[] = [
    {
      key: "status",
      header: tCommon("status"),
      render: (r) => {
        const status = r.status.toLowerCase() as FlightStatus;
        return <StatusBadge status={status}>{tStatus(status)}</StatusBadge>;
      },
    },
    {
      key: "date",
      header: tCommon("date"),
      render: (r) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(r.date)),
    },
    { key: "flightNo", header: "Flt No", render: (r) => r.flightNo },
    { key: "route", header: "Route", render: (r) => r.route },
    { key: "aircraft", header: "Reg", render: (r) => r.aircraftRegistration },
    { key: "serviceType", header: tCommon("type"), render: (r) => r.serviceType, hideOnCard: true },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <a
              href="/api/schedule/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {t("exportPdf")}
            </a>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-medium text-fg-on-brand"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addFlight")}
            </button>
          </>
        }
      />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            rows={flights}
            rowKey={(r) => r.id}
            onRowClick={openEdit}
            emptyState={tCommon("noResults")}
          />
        </div>
      </div>

      <FlightFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        stations={stations}
        aircraft={aircraft}
        editing={editing}
      />
    </div>
  );
}
