/**
 * Minimal IndexedDB-backed key-value storage — Faz 8 görev 10 ("Offline:
 * IndexedDB'ye yaz, bağlantı gelince senkronize et"). No dependency: a
 * single object store holding JSON-serializable values under string
 * keys. Satisfies both zustand's `StateStorage` interface (persist
 * middleware, for the in-progress load-plan draft) and TanStack Query's
 * async storage persister interface (for the paused-mutation queue that
 * resumes on reconnect) — both just want getItem/setItem/removeItem.
 *
 * No-ops on the server (no `indexedDB` global) so this is safe to import
 * from a component that also renders during SSR.
 */

const DB_NAME = "tua-load-control";
const STORE_NAME = "kv";

function isSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = fn(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export const idbStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isSupported()) return null;
    const value = await withStore<string | undefined>("readonly", (store) => store.get(key));
    return value ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!isSupported()) return;
    await withStore("readwrite", (store) => store.put(value, key));
  },
  async removeItem(key: string): Promise<void> {
    if (!isSupported()) return;
    await withStore("readwrite", (store) => store.delete(key));
  },
};
