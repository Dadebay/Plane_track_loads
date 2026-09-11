"use client";

import { useTranslations } from "next-intl";
import { buildEnvelopeExtent } from "@tua/wnb-core";
import type { CgLimits, WnbResult } from "@tua/wnb-core";
import { formatWeight } from "@/lib/format-number";

/**
 * Live CG envelope, driven by the same `cgLimits` breakpoints *and the
 * same axis extent* the ENV PDF renders from — @tua/wnb-core's
 * `buildEnvelopeExtent()` computes both, so the chart the controller
 * approves is the chart that prints.
 *
 * Informational only. The authority on whether a plan may be saved is the
 * server's `checkEnvelope`; this shows the controller where they are while
 * they work. The caption says so, in words, so nobody reads a green dot as
 * an approval.
 */

const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
const W = 320;
const H = 220;

interface Series {
  label: string;
  weight: number;
  index: number;
  within: boolean;
}

export function CgEnvelopeChart({
  cgLimits,
  wnb,
  phases,
}: {
  cgLimits: CgLimits;
  wnb: WnbResult;
  phases: { zfw: boolean; tow: boolean; ldw: boolean };
}) {
  const t = useTranslations("loadPlan.envelope");

  const curves = [
    { key: "zfw", curve: cgLimits.zfw },
    { key: "tow", curve: cgLimits.takeoff },
  ] as const;

  const points: Series[] = [
    { label: "ZFW", weight: Number(wnb.zfw), index: Number(wnb.lizfw), within: phases.zfw },
    { label: "TOW", weight: Number(wnb.tow), index: Number(wnb.litow), within: phases.tow },
    { label: "LDW", weight: Number(wnb.ldw), index: Number(wnb.lilaw), within: phases.ldw },
  ];

  // One extent for screen and print (@tua/wnb-core). Rounded outward to
  // the tick grid, so a point sitting exactly on a limit is still visibly
  // inside the plot area rather than on its border.
  const extent = buildEnvelopeExtent({
    curves: [cgLimits.zfw, cgLimits.takeoff],
    points: points.map((p) => ({ weight: String(p.weight), index: String(p.index) })),
  });

  const minW = Number(extent.weightMin);
  const maxW = Number(extent.weightMax);
  const minI = Number(extent.indexMin);
  const maxI = Number(extent.indexMax);

  const spanW = maxW - minW || 1;
  const spanI = maxI - minI || 1;

  const x = (index: number) => PAD.left + ((index - minI) / spanI) * (W - PAD.left - PAD.right);
  const y = (weight: number) => H - PAD.bottom - ((weight - minW) / spanW) * (H - PAD.top - PAD.bottom);

  const path = (breakpoints: { weight: string; index: string }[]) =>
    breakpoints.map((p, i) => `${i === 0 ? "M" : "L"} ${x(Number(p.index))} ${y(Number(p.weight))}`).join(" ");

  return (
    <figure className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("title")}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={points
          .map((p) => `${p.label} ${formatWeight(String(p.weight))} kg, ${t(p.within ? "inside" : "outside")}`)
          .join("; ")}
      >
        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="var(--border)" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="var(--border)" />
        <text x={PAD.left - 4} y={PAD.top + 8} textAnchor="end" fontSize="8" fill="var(--fg-subtle)">
          {Math.round(maxW / 1000)}t
        </text>
        <text x={PAD.left - 4} y={H - PAD.bottom} textAnchor="end" fontSize="8" fill="var(--fg-subtle)">
          {Math.round(minW / 1000)}t
        </text>
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="8" fill="var(--fg-subtle)">
          {t("indexAxis")}
        </text>

        {curves.map(({ key, curve }) => (
          <g key={key}>
            <path d={path(curve.forward)} fill="none" stroke="var(--border)" strokeWidth="1.5" />
            <path d={path(curve.aft)} fill="none" stroke="var(--border)" strokeWidth="1.5" />
          </g>
        ))}

        {points.map((point) => (
          <g key={point.label}>
            {/* Shape as well as colour: a square inside, a triangle outside. */}
            {point.within ? (
              <rect
                x={x(point.index) - 3.5}
                y={y(point.weight) - 3.5}
                width={7}
                height={7}
                fill="var(--info)"
                stroke="var(--bg)"
              />
            ) : (
              <path
                d={`M ${x(point.index)} ${y(point.weight) - 5} L ${x(point.index) + 5} ${y(point.weight) + 4} L ${
                  x(point.index) - 5
                } ${y(point.weight) + 4} Z`}
                fill="var(--danger)"
                stroke="var(--bg)"
              />
            )}
            <text
              x={x(point.index) + 8}
              y={y(point.weight) + 3}
              fontSize="8"
              fill="var(--fg-muted)"
              className="font-mono"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-fg-subtle">{t("informational")}</p>
    </figure>
  );
}
