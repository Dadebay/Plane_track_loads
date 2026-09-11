"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/lib/idb-storage";
import type { DraftLoadItem } from "@/lib/load-plan-calc";
import type { FuelState, TankAllocation } from "@tua/wnb-core";

/** The six tanks the plate names, in the order they are shown. AHM 560
 * Appendix I s.75: INNER and OUTER are left/right pairs, CENTER and TRIM
 * sit on the centreline. */
export const TANK_SLOTS: readonly { tank: TankAllocation["tank"]; side: TankAllocation["side"] }[] = [
  { tank: "OUTER", side: "LEFT" },
  { tank: "INNER", side: "LEFT" },
  { tank: "CENTER", side: "CENTRE" },
  { tank: "INNER", side: "RIGHT" },
  { tank: "OUTER", side: "RIGHT" },
  { tank: "TRIM", side: "CENTRE" },
];

export interface LoadDraftInit {
  items: DraftLoadItem[];
  fuel: FuelState;
  /** Per-tank distribution of the takeoff fuel. Empty until the controller
   * enters one; a non-empty list must sum exactly to takeoffFuel. */
  fuelAllocations: TankAllocation[];
  cockpitCrew: number | null;
  courierCrew: number | null;
}

interface LoadDraftState extends LoadDraftInit {
  legId: string | null;
  hasHydrated: boolean;
  /** No-ops if already initialized for this leg — lets a page reload (or
   * coming back online) resume the locally-persisted draft instead of
   * clobbering it with the server's last-saved snapshot. */
  initialize: (legId: string, initial: LoadDraftInit) => void;
  upsertItem: (item: DraftLoadItem) => void;
  removeItem: (position: string) => void;
  setItems: (items: DraftLoadItem[]) => void;
  setFuel: (fuel: FuelState) => void;
  setFuelAllocation: (tank: TankAllocation["tank"], side: TankAllocation["side"], weight: string) => void;
  clearFuelAllocations: () => void;
  setCrew: (cockpitCrew: number | null, courierCrew: number | null) => void;
  setHasHydrated: (value: boolean) => void;
}

const EMPTY_FUEL: FuelState = { density: "0.785", takeoffFuel: "0", tripFuel: "0", taxiFuel: "0" };

export const useLoadDraftStore = create<LoadDraftState>()(
  persist(
    (set) => ({
      legId: null,
      items: [],
      fuel: EMPTY_FUEL,
      fuelAllocations: [],
      cockpitCrew: null,
      courierCrew: null,
      hasHydrated: false,

      initialize: (legId, initial) =>
        set((state) => (state.legId === legId ? state : { legId, ...initial })),

      upsertItem: (item) =>
        set((state) => {
          const others = state.items.filter((i) => i.position !== item.position);
          const hasWeight = item.weight !== "" && Number(item.weight) > 0;
          return { items: hasWeight ? [...others, item] : others };
        }),

      removeItem: (position) => set((state) => ({ items: state.items.filter((i) => i.position !== position) })),

      setItems: (items) => set({ items }),

      setFuel: (fuel) => set({ fuel }),

      setFuelAllocation: (tank, side, weight) =>
        set((state) => {
          const others = state.fuelAllocations.filter((a) => !(a.tank === tank && a.side === side));
          const hasWeight = weight !== "" && Number(weight) > 0;
          return { fuelAllocations: hasWeight ? [...others, { tank, side, weight }] : others };
        }),

      clearFuelAllocations: () => set({ fuelAllocations: [] }),

      setCrew: (cockpitCrew, courierCrew) => set({ cockpitCrew, courierCrew }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "load-draft",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        legId: state.legId,
        items: state.items,
        fuel: state.fuel,
        fuelAllocations: state.fuelAllocations,
        cockpitCrew: state.cockpitCrew,
        courierCrew: state.courierCrew,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
