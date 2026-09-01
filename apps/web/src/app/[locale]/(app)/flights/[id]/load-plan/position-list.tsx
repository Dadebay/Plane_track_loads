"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Position } from "@tua/wnb-core";
import { useLoadDraftStore } from "./load-draft-store";
import { groupByCode, type PositionGroup } from "./position-groups";

export function PositionList({
  positions,
  overloaded,
  onSelect,
}: {
  positions: Position[];
  overloaded: Set<string>;
  onSelect: (code: string) => void;
}) {
  const t = useTranslations("loadPlan.positions");
  const items = useLoadDraftStore((s) => s.items);

  const groups = useMemo(() => groupByCode(positions), [positions]);
  const mainDeck = groups.filter((g) => g.deck === "MAIN");
  const lowerDeck = groups.filter((g) => g.deck === "LOWER");
  const itemByPosition = useMemo(() => new Map(items.map((i) => [i.position, i])), [items]);

  function renderGroup(group: PositionGroup) {
    const item = itemByPosition.get(group.code);
    const isOverloaded = overloaded.has(group.code);
    return (
      <li key={group.code}>
        <button
          type="button"
          onClick={() => onSelect(group.code)}
          className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left hover:bg-bg-muted"
        >
          <span className="font-mono text-sm font-semibold text-fg">{group.code}</span>
          <span
            className={
              isOverloaded
                ? "text-sm font-medium text-danger"
                : item
                  ? "text-sm text-fg"
                  : "text-sm text-fg-subtle"
            }
          >
            {isOverloaded ? t("overloaded") : item ? t("occupied", { weight: item.weight }) : t("empty")}
          </span>
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
