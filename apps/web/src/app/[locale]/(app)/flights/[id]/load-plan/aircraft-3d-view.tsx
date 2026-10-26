"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Box, RotateCcw, Focus, Plus, Minus, Layers, ArrowUp } from "lucide-react";
import type { LoadPlanAhmData } from "@/lib/load-plan-calc";
import type { WorkspaceCell } from "@/lib/position-workspace";
import { buildCargoSceneData, type CargoDeck } from "@/lib/aircraft-3d-layout";
import { formatWeight } from "@/lib/format-number";
import { useLoadDraftStore } from "./load-draft-store";
import { CargoScene } from "./three/cargo-scene";

const control =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:bg-bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40";

export default function Aircraft3DView({
  ahmData,
  overloaded,
  readOnly,
  registration,
  onSelect,
  onBlocked,
  onReturnToPlan,
}: {
  ahmData: LoadPlanAhmData;
  overloaded: Set<string>;
  readOnly: boolean;
  registration: string;
  onSelect: (code: string, uldType: string) => void;
  onBlocked: (cell: WorkspaceCell) => void;
  onReturnToPlan: () => void;
}) {
  const t = useTranslations("loadPlan.threeD");
  const tPositions = useTranslations("loadPlan.positions");
  const { resolvedTheme } = useTheme();
  const items = useLoadDraftStore((s) => s.items);
  const data = useMemo(
    () => buildCargoSceneData(ahmData, items, overloaded, readOnly),
    [ahmData, items, overloaded, readOnly],
  );
  const [deck, setDeck] = useState<CargoDeck>("MAIN");
  const [rowId, setRowId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [shell, setShell] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CargoScene | null>(null);
  const rows = deck === "MAIN" ? data.workspace.main : data.workspace.lower;
  const row = rows.find((r) => r.id === rowId) ?? rows[0];
  const chosen = data.placements.find((p) => p.key === selected && p.deck === deck);
  // Show the selected row's free slots AND every already loaded item. A
  // different configuration must never make an existing ULD disappear.
  const choices = data.placements.filter(
    (p) => p.deck === deck && (p.cell.uldType === row?.id || p.cell.weight !== null),
  );
  const deckWeight = deck === "MAIN" ? data.mainWeight : data.lowerWeight;

  useEffect(() => {
    if (!host.current || failed) return;
    try {
      scene.current = new CargoScene(
        host.current,
        setSelected,
        () => setFailed(true),
        registration,
      );
    } catch {
      setFailed(true);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, [failed, registration]);

  useEffect(() => {
    scene.current?.update({
      data,
      deck,
      row: row?.id ?? "",
      selected,
      labels,
      shell,
      dark: resolvedTheme === "dark",
    });
  }, [data, deck, row?.id, selected, labels, shell, resolvedTheme, failed, registration]);

  const selectDeck = (value: CargoDeck) => {
    setDeck(value);
    setSelected(null);
  };
  const chooseAction = () => {
    if (!chosen || readOnly) return;
    if (chosen.cell.state === "BLOCKED") onBlocked(chosen.cell);
    else onSelect(chosen.cell.code, chosen.cell.uldType);
  };

  return (
    <section
      className="border-border bg-bg-subtle min-w-0 overflow-hidden rounded-xl border"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-slate-50">
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold">{t("title")}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-slate-300">{registration}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-300">{t("totalGross")}</p>
          <p className="font-mono text-lg font-semibold tabular-nums">
            {t("kg", { weight: formatWeight(data.totalWeight) })}
          </p>
        </div>
      </div>

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div role="group" aria-label={t("deck")} className="flex gap-1">
          {(["MAIN", "LOWER"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => selectDeck(value)}
              aria-pressed={deck === value}
              className={`${control} ${deck === value ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : ""}`}
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              {value === "MAIN" ? tPositions("mainDeck") : tPositions("lowerDeck")}
            </button>
          ))}
        </div>
        <label className="text-fg-subtle flex w-full min-w-0 flex-none items-center gap-2 text-xs sm:w-auto sm:max-w-sm sm:flex-1">
          <span>{t("configuration")}</span>
          <select
            value={row?.id ?? ""}
            onChange={(e) => {
              setRowId(e.target.value);
              setSelected(null);
            }}
            className="border-border bg-bg text-fg h-11 min-w-0 flex-1 rounded-md border px-2 text-xs"
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {failed ? (
        <div
          role="status"
          className="text-fg-subtle flex min-h-80 flex-col items-center justify-center gap-4 p-6 text-center text-sm"
        >
          <p>{t("unavailable")}</p>
          <button type="button" className={control} onClick={onReturnToPlan}>
            {t("returnToPlan")}
          </button>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={host}
            className="h-[420px] w-full sm:h-[520px] 2xl:h-[600px]"
            role="img"
            aria-label={t("canvasLabel")}
          />
          <div className="border-border bg-bg/95 pointer-events-none absolute left-3 top-3 rounded-lg border px-3 py-2 shadow-sm">
            <p className="text-fg-subtle text-[10px] uppercase tracking-wide">
              {deck === "MAIN" ? tPositions("mainDeck") : tPositions("lowerDeck")}
            </p>
            <p className="text-fg font-mono text-sm font-semibold">
              {t("kg", { weight: formatWeight(deckWeight) })}
            </p>
            <p className="text-fg-subtle mt-0.5 text-[10px]">
              {t("loadedCount", { count: data.loaded.filter((p) => p.deck === deck).length })}
            </p>
          </div>
          <div className="absolute right-3 top-3 flex flex-col gap-1">
            <button
              type="button"
              className={control}
              title={t("reset")}
              aria-label={t("reset")}
              onClick={() => scene.current?.reset()}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={control}
              title={t("top")}
              aria-label={t("top")}
              onClick={() => scene.current?.top()}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={control}
              title={t("zoomIn")}
              aria-label={t("zoomIn")}
              onClick={() => scene.current?.zoom(0.8)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={control}
              title={t("zoomOut")}
              aria-label={t("zoomOut")}
              onClick={() => scene.current?.zoom(1.25)}
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <p className="bg-bg/95 text-fg-subtle pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md px-2.5 py-1.5 text-[11px]">
            {t("interaction")}
          </p>
        </div>
      )}

      <div className="border-border text-fg flex flex-wrap items-center gap-x-5 gap-y-2 border-y px-3 py-2 text-xs">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={labels}
            onChange={(e) => setLabels(e.target.checked)}
            className="accent-brand-600 h-4 w-4"
          />
          {t("showWeights")}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={shell}
            onChange={(e) => setShell(e.target.checked)}
            className="accent-brand-600 h-4 w-4"
          />
          {t("showExterior")}
        </label>
        <span className="text-fg-subtle">{t("illustrative")}</span>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="text-fg flex min-w-0 flex-col gap-1.5 text-xs font-medium">
          {t("selectPosition")}
          <select
            aria-label={t("selectPosition")}
            value={chosen?.key ?? ""}
            onChange={(e) => setSelected(e.target.value || null)}
            className="border-border bg-bg h-11 min-w-0 rounded-md border px-2 text-sm"
          >
            <option value="">{t("selectHint")}</option>
            {choices.map((p) => (
              <option key={p.key} value={p.key}>
                {p.cell.code} ·{" "}
                {p.cell.weight !== null
                  ? t("kg", { weight: formatWeight(p.cell.weight) })
                  : t(`state.${p.cell.state}`)}{" "}
                · {p.cell.rowLabel}
              </option>
            ))}
          </select>
          <p className="text-fg-subtle font-normal">{readOnly ? t("readOnly") : t("editHint")}</p>
        </label>
        {chosen ? (
          <div className="border-border bg-bg rounded-lg border p-3" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-fg font-mono text-base font-semibold">{chosen.cell.code}</span>
              <span
                className={`text-xs ${chosen.cell.state === "OVERLOADED" ? "text-danger font-semibold" : "text-fg-subtle"}`}
              >
                {t(`state.${chosen.cell.state}`)}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-fg-subtle">{t("gross")}</dt>
                <dd className="text-fg mt-0.5 font-mono text-sm font-semibold">
                  {t("kg", { weight: formatWeight(chosen.cell.weight ?? "0") })}
                </dd>
              </div>
              <div>
                <dt className="text-fg-subtle">{t("limit")}</dt>
                <dd className="text-fg mt-0.5 font-mono text-sm">
                  {t("kg", { weight: formatWeight(chosen.cell.maxGross) })}
                </dd>
              </div>
            </dl>
            {chosen.cell.uldCode ? (
              <p className="text-fg-subtle mt-2 break-all font-mono text-xs">
                {chosen.cell.uldCode}
              </p>
            ) : null}
            {chosen.approximate ? (
              <p className="text-fg-subtle mt-2 text-xs">{t("bulkNote")}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={control} disabled={readOnly} onClick={chooseAction}>
                {chosen.cell.state === "BLOCKED"
                  ? t("blockedDetails")
                  : chosen.cell.weight !== null
                    ? t("editLoad")
                    : t("addLoad")}
              </button>
              {chosen.cell.weight !== null && !failed ? (
                <button type="button" className={control} onClick={() => scene.current?.focus()}>
                  <Focus className="h-4 w-4" aria-hidden="true" />
                  {t("focus")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="border-border text-fg-subtle flex items-center rounded-lg border border-dashed p-3 text-xs">
            {t("selectionHint")}
          </div>
        )}
      </div>
      {data.unmapped.length > 0 ? (
        <p role="status" className="bg-warning-bg text-warning mx-3 mb-3 rounded-md p-3 text-xs">
          {t("unmapped", { codes: data.unmapped.map((i) => i.position).join(", ") })}
        </p>
      ) : null}
    </section>
  );
}
