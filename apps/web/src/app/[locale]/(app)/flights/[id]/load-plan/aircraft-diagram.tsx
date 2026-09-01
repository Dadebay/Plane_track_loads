"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Position } from "@tua/wnb-core";
import { AIRCRAFT_LAYOUT, type PositionRect } from "@/lib/aircraft-layout";
import { useLoadDraftStore } from "./load-draft-store";
import { groupByCode } from "./position-groups";

interface DeckSvgProps {
  deck: "main" | "lower";
  rects: PositionRect[];
  occupiedCodes: Set<string>;
  overloaded: Set<string>;
  onSelect: (code: string) => void;
  compact: boolean;
}

function DeckSvg({ deck, rects, occupiedCodes, overloaded, onSelect, compact }: DeckSvgProps) {
  const { width, height } = AIRCRAFT_LAYOUT[deck];
  const fontSize = compact ? 9 : 11;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      {rects.map((rect) => {
        const isOverloaded = overloaded.has(rect.code);
        const isOccupied = occupiedCodes.has(rect.code);
        const fill = isOverloaded ? "var(--danger-bg)" : isOccupied ? "var(--info-bg)" : "var(--bg-muted)";
        const stroke = isOverloaded ? "var(--danger)" : isOccupied ? "var(--info)" : "var(--border)";
        return (
          <g
            key={rect.code}
            onClick={() => onSelect(rect.code)}
            className="cursor-pointer"
            role="button"
            aria-label={rect.code}
          >
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              rx={4}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {!compact || rect.w > 30 ? (
              <text
                x={rect.x + rect.w / 2}
                y={rect.y + rect.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fill="var(--fg)"
                className="pointer-events-none select-none font-mono font-medium"
              >
                {rect.code}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Faz 8 görev 2/9 — clickable SVG floor plan (full size on desktop,
 * shrunk via `compact` to serve as the sticky mobile mini-map). Geometry
 * comes entirely from aircraft-layout.ts's schematic layout, keyed by the
 * same position codes @tua/ahm-data uses — never hardcoded pixel math
 * inline here. */
export function AircraftDiagram({
  positions,
  overloaded,
  onSelect,
  compact = false,
}: {
  positions: Position[];
  overloaded: Set<string>;
  onSelect: (code: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations("loadPlan.positions");
  const items = useLoadDraftStore((s) => s.items);

  const groups = useMemo(() => groupByCode(positions), [positions]);
  const mainRects = groups.filter((g) => g.deck === "MAIN").map((g) => AIRCRAFT_LAYOUT.main.positions[g.code]!);
  const lowerRects = groups.filter((g) => g.deck === "LOWER").map((g) => AIRCRAFT_LAYOUT.lower.positions[g.code]!);
  const occupiedCodes = useMemo(() => new Set(items.map((i) => i.position)), [items]);

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
      <div>
        {!compact ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("mainDeck")}</p> : null}
        <DeckSvg deck="main" rects={mainRects} occupiedCodes={occupiedCodes} overloaded={overloaded} onSelect={onSelect} compact={compact} />
      </div>
      {!compact ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("lowerDeck")}</p>
          <DeckSvg deck="lower" rects={lowerRects} occupiedCodes={occupiedCodes} overloaded={overloaded} onSelect={onSelect} compact={compact} />
        </div>
      ) : null}
    </div>
  );
}
