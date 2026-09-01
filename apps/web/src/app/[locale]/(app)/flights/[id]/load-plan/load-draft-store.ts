"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/lib/idb-storage";
import type { DraftLoadItem } from "@/lib/load-plan-calc";
import type { FuelState } from "@tua/wnb-core";

export interface LoadDraftInit {
  items: DraftLoadItem[];
  fuel: FuelState;
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
        cockpitCrew: state.cockpitCrew,
        courierCrew: state.courierCrew,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
