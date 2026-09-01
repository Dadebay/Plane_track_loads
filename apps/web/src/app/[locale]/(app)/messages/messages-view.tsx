"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, PageHeader, StatusBadge, type DataTableColumn } from "@tua/ui";
import { formatDateTime } from "@/lib/format-date";
import { generateCpm, generateLdm, generateMvt, retryMessage, createMessageAddress, parseIncomingCpm } from "./actions";

type MessageType = "LDM" | "CPM" | "MVT" | "FFM" | "FBL";
type MvtEvent = "OFF" | "ON" | "ARR" | "DEP";

const GENERATE_ACTIONS = { LDM: generateLdm, CPM: generateCpm } as const;

export interface LegOption {
  id: string;
  flightNo: string;
  route: string;
  date: string;
}

export interface AddressOption {
  id: string;
  messageType: MessageType;
  label: string;
  sita: string | null;
  email: string | null;
}

export interface MessageRow {
  id: string;
  messageType: MessageType;
  flightNo: string;
  addressLabel: string;
  status: "PENDING" | "RETRYING" | "SENT" | "FAILED";
  attempts: number;
  lastError: string | null;
  createdByName: string;
  createdAt: string;
  body: string;
}

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

const STATUS_TONE: Record<MessageRow["status"], "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "info",
  RETRYING: "warning",
  SENT: "success",
  FAILED: "danger",
};

export function MessagesView({
  legs,
  addresses,
  messages,
}: {
  legs: LegOption[];
  addresses: AddressOption[];
  messages: MessageRow[];
}) {
  const t = useTranslations("messages");
  const tNav = useTranslations("nav");

  const [messageType, setMessageType] = useState<"LDM" | "CPM" | "MVT">("LDM");
  const [legId, setLegId] = useState(legs[0]?.id ?? "");
  const [addressId, setAddressId] = useState("");
  const [event, setEvent] = useState<MvtEvent>("OFF");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [addrType, setAddrType] = useState<MessageType>("LDM");
  const [addrLabel, setAddrLabel] = useState("");
  const [addrSita, setAddrSita] = useState("");
  const [addrEmail, setAddrEmail] = useState("");
  const [addrError, setAddrError] = useState<string | null>(null);
  const [addrSuccess, setAddrSuccess] = useState(false);

  const [incomingText, setIncomingText] = useState("");
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [incomingResult, setIncomingResult] = useState<Awaited<ReturnType<typeof parseIncomingCpm>>["parsed"] | null>(
    null,
  );

  const addressOptions = addresses.filter((a) => a.messageType === messageType);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result =
      messageType === "MVT"
        ? await generateMvt({ legId, addressId, event })
        : await GENERATE_ACTIONS[messageType]({ legId, addressId });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "validation");
      return;
    }
    setSuccess(messageType);
  }

  async function handleRetry(messageId: string) {
    await retryMessage({ messageId });
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddrError(null);
    setAddrSuccess(false);
    const result = await createMessageAddress({
      messageType: addrType,
      label: addrLabel,
      sita: addrSita || undefined,
      email: addrEmail || undefined,
    });
    if (!result.ok) {
      setAddrError(result.error ?? "validation");
      return;
    }
    setAddrSuccess(true);
    setAddrLabel("");
    setAddrSita("");
    setAddrEmail("");
  }

  async function handleParseIncoming(e: React.FormEvent) {
    e.preventDefault();
    setIncomingError(null);
    setIncomingResult(null);
    const result = await parseIncomingCpm({ text: incomingText });
    if (!result.ok) {
      setIncomingError(result.error ?? "parseError");
      return;
    }
    setIncomingResult(result.parsed ?? null);
  }

  const columns: DataTableColumn<MessageRow>[] = [
    { key: "type", header: t("list.type"), render: (m) => m.messageType },
    { key: "flight", header: t("list.flight"), render: (m) => m.flightNo },
    { key: "address", header: t("list.address"), render: (m) => m.addressLabel, hideOnCard: true },
    {
      key: "status",
      header: t("list.status"),
      render: (m) => (
        <span className="inline-flex items-center gap-2">
          <StatusBadge tone={STATUS_TONE[m.status]}>{m.status}</StatusBadge>
          {m.status === "FAILED" || m.status === "RETRYING" ? (
            <button
              type="button"
              onClick={() => handleRetry(m.id)}
              className="text-xs font-medium text-brand-500 hover:underline"
            >
              {t("list.retry")}
            </button>
          ) : null}
        </span>
      ),
    },
    { key: "attempts", header: t("list.attempts"), render: (m) => String(m.attempts), hideOnCard: true },
    { key: "createdBy", header: t("list.createdBy"), render: (m) => m.createdByName, hideOnCard: true },
    { key: "createdAt", header: t("list.createdAt"), render: (m) => `${formatDateTime(new Date(m.createdAt))} UTC` },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={tNav("messages")} />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <form onSubmit={handleGenerate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-fg">{t("generate.title")}</h2>
          {error ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {t(`generate.errors.${error}` as never)}
            </p>
          ) : null}
          {success ? <p className="text-sm text-success">{t("generate.success", { type: success })}</p> : null}

          {legs.length === 0 ? (
            <p className="text-sm text-fg-subtle">{t("generate.noFinalizedPlans")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                {t("generate.messageType")}
                <select
                  value={messageType}
                  onChange={(e) => {
                    setMessageType(e.target.value as typeof messageType);
                    setAddressId("");
                  }}
                  className={inputClass}
                >
                  <option value="LDM">LDM</option>
                  <option value="CPM">CPM</option>
                  <option value="MVT">MVT</option>
                </select>
              </label>
              <label className={labelClass}>
                {t("generate.leg")}
                <select required value={legId} onChange={(e) => setLegId(e.target.value)} className={inputClass}>
                  {legs.map((leg) => (
                    <option key={leg.id} value={leg.id}>
                      {leg.flightNo} · {leg.route} · {leg.date}
                    </option>
                  ))}
                </select>
              </label>
              {messageType === "MVT" ? (
                <label className={labelClass}>
                  {t("generate.event")}
                  <select value={event} onChange={(e) => setEvent(e.target.value as MvtEvent)} className={inputClass}>
                    <option value="OFF">OFF</option>
                    <option value="ON">ON</option>
                    <option value="DEP">DEP</option>
                    <option value="ARR">ARR</option>
                  </select>
                </label>
              ) : null}
              <label className={labelClass}>
                {t("generate.address")}
                <select required value={addressId} onChange={(e) => setAddressId(e.target.value)} className={inputClass}>
                  <option value="" disabled>
                    —
                  </option>
                  {addressOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} ({a.sita ?? a.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {legs.length > 0 ? (
            <button
              type="submit"
              disabled={saving || !addressId}
              className="inline-flex h-11 items-center justify-center self-start rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
            >
              {saving ? t("generate.generating") : t("generate.generate")}
            </button>
          ) : null}
        </form>

        <form onSubmit={handleAddAddress} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-fg">{t("addressBook.title")}</h2>
          {addrError ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {t(`addressBook.errors.${addrError}` as never)}
            </p>
          ) : null}
          {addrSuccess ? <p className="text-sm text-success">{t("addressBook.success")}</p> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className={labelClass}>
              {t("generate.messageType")}
              <select value={addrType} onChange={(e) => setAddrType(e.target.value as MessageType)} className={inputClass}>
                <option value="LDM">LDM</option>
                <option value="CPM">CPM</option>
                <option value="MVT">MVT</option>
                <option value="FFM">FFM</option>
                <option value="FBL">FBL</option>
              </select>
            </label>
            <label className={labelClass}>
              {t("addressBook.label")}
              <input value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} className={inputClass} required />
            </label>
            <label className={labelClass}>
              {t("addressBook.sita")}
              <input value={addrSita} onChange={(e) => setAddrSita(e.target.value.toUpperCase())} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("addressBook.email")}
              <input value={addrEmail} onChange={(e) => setAddrEmail(e.target.value)} className={inputClass} />
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center self-start rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand sm:h-9"
          >
            {t("addressBook.add")}
          </button>

          <div className="mt-2 flex flex-col gap-1">
            {addresses.map((a) => (
              <p key={a.id} className="text-xs text-fg-muted">
                {a.messageType} — {a.label} ({a.sita ?? a.email})
              </p>
            ))}
          </div>
        </form>

        <form onSubmit={handleParseIncoming} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-fg">{t("incomingCpm.title")}</h2>
          {incomingError ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {incomingError}
            </p>
          ) : null}
          <textarea
            value={incomingText}
            onChange={(e) => setIncomingText(e.target.value)}
            rows={4}
            className={inputClass}
            placeholder={t("incomingCpm.placeholder")}
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center self-start rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand sm:h-9"
          >
            {t("incomingCpm.parse")}
          </button>
          {incomingResult ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-fg-muted">
                    <th className="px-2 py-1">POS</th>
                    <th className="px-2 py-1">ULD</th>
                    <th className="px-2 py-1">AWB</th>
                    <th className="px-2 py-1">KG</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingResult.positions.map((p) => (
                    <tr key={p.position} className="border-b border-border">
                      <td className="px-2 py-1">{p.position}</td>
                      <td className="px-2 py-1">{p.uldCode ?? "—"}</td>
                      <td className="px-2 py-1">{p.awb ?? "—"}</td>
                      <td className="px-2 py-1">{p.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </form>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">{t("list.title")}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <DataTable columns={columns} rows={messages} rowKey={(m) => m.id} emptyState={t("list.empty")} />
          </div>
        </div>
      </div>
    </div>
  );
}
