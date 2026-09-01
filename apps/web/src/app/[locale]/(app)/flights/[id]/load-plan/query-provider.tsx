"use client";

import { useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { idbStorage } from "@/lib/idb-storage";

/**
 * Faz 8 görev 10 — "Offline: ... bağlantı gelince senkronize et". Save
 * mutations use TanStack Query's default `networkMode: "online"`: while
 * offline, a mutation is left `isPaused` instead of failing, and its
 * persisted queue entry survives a reload (via the IndexedDB persister
 * below); `resumePausedMutations()` on successful cache restore replays
 * any that were still pending once the connection comes back.
 */
export function LoadPlanQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [persister] = useState(() => createAsyncStoragePersister({ storage: idbStorage, key: "load-plan-mutations" }));

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister }}
      onSuccess={() => {
        void client.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
