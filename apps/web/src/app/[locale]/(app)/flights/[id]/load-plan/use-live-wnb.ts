"use client";

import { useEffect, useState } from "react";
import { computeLiveWnb, type LiveWnbResult, type LoadPlanAhmData } from "@/lib/load-plan-calc";
import { useLoadDraftStore } from "./load-draft-store";

const DEBOUNCE_MS = 150;

/** Faz 8 görev 4 — recomputes the full W&B result 150ms after the last
 * draft edit, entirely client-side (wnb-core has zero fs/framework
 * dependency), so live feedback never waits on a network round-trip. */
export function useLiveWnb(ahmData: LoadPlanAhmData, registration: string): LiveWnbResult {
  const items = useLoadDraftStore((s) => s.items);
  const fuel = useLoadDraftStore((s) => s.fuel);
  const cockpitCrew = useLoadDraftStore((s) => s.cockpitCrew);
  const courierCrew = useLoadDraftStore((s) => s.courierCrew);

  const [result, setResult] = useState<LiveWnbResult>(() =>
    computeLiveWnb({ items, fuel, cockpitCrew, courierCrew }, ahmData, registration),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(computeLiveWnb({ items, fuel, cockpitCrew, courierCrew }, ahmData, registration));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [items, fuel, cockpitCrew, courierCrew, ahmData, registration]);

  return result;
}
