"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Position, PositionIndexRow } from "@tua/wnb-core";
import { formatIndex, formatWeight } from "@/lib/format-number";
import { useLoadDraftStore } from "./load-draft-store";
import { groupByCode, type PositionGroup } from "./position-groups";

export function PositionList({
  positions,
  overloaded,
  indexRows,
  onSelect,
}: {
  positions: Position[];
  overloaded: Set<string>;
  indexRows: PositionIndexRow[];
  onSelect: (code: string) => void;
}) {
  const t = useTranslations("loadPlan.positions");
  const items = useLoadDraftStore((s) => s.items);

  const groups = useMemo(() => groupByCode(positions), [positions]);
  const mainDeck = groups.filter((g) => g.deck === "MAIN");
  const lowerDeck = groups.filter((g) => g.deck === "LOWER");
  const itemByPosition = useMemo(() => new Map(items.map((i) => [i.position, i])), [items]);
  const indexByPosition = useMemo(() => new Map(indexRows.map((r) => [r.position, r])), [indexRows]);

  function renderGroup(group: PositionGroup) {
    const item = itemByPosition.get(group.code);
    const indexRow = indexByPosition.get(group.code);
    const isOverloaded = overloaded.has(group.code);

    return (
      <li key={group.code}>
        <button
          type="button"
          onClick={() => onSelect(group.code)}
          className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left hover:bg-bg-muted"
        >
          <span className="font-mono text-sm font-semibold text-fg">{group.code}</span>

          {item ? (
            <span className="flex items-center gap-3">
              <span className={isOverloaded ? "font-mono text-sm font-medium text-danger" : "font-mono text-sm text-fg"}>
                {formatWeight(item.weight)}
              </span>
              {indexRow ? (
                /* The exact index contribution of this position — what the
                   loadmaster otherwise totals by hand from the printed card. */
                <span className="font-mono text-sm tabular-nums text-brand-600">{formatIndex(indexRow.index)}</span>
              ) : null}
              {isOverloaded ? <span className="text-xs font-medium text-danger">{t("overloaded")}</span> : null}
            </span>
          ) : (
            <span className="text-sm text-fg-subtle">{t("empty")}</span>
          )}
        </button>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border">
        <h3 className="border-b border-border bg-bg-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t("mainDeck")}
        </h3>
        <ul>{mainDeck.map(renderGroup)}</ul>
      </div>
      <div className="rounded-lg border border-border">
        <h3 className="border-b border-border bg-bg-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t("lowerDeck")}
        </h3>
        <ul>{lowerDeck.map(renderGroup)}</ul>
      </div>
    </div>
  );
}
