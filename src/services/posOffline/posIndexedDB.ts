const DB_NAME = "MenuMestrePOSDB";
const DB_VERSION = 1;

export const POS_STORES = {
  OUTBOX: "pos_outbox",
  CATALOG: "pos_catalog",
  SESSION: "pos_session",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openPOSDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POS_STORES.OUTBOX)) {
        const outbox = db.createObjectStore(POS_STORES.OUTBOX, { keyPath: "client_order_id" });
        outbox.createIndex("status", "status", { unique: false });
        outbox.createIndex("restaurant_id", "restaurant_id", { unique: false });
        outbox.createIndex("created_at", "created_at", { unique: false });
      }
      if (!db.objectStoreNames.contains(POS_STORES.CATALOG)) {
        db.createObjectStore(POS_STORES.CATALOG, { keyPath: "restaurant_id" });
      }
      if (!db.objectStoreNames.contains(POS_STORES.SESSION)) {
        db.createObjectStore(POS_STORES.SESSION, { keyPath: "restaurant_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openPOSDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut<T extends { [key: string]: unknown }>(
  storeName: string,
  value: T
): Promise<void> {
  const db = await openPOSDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openPOSDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openPOSDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGetAllByIndex<T>(
  storeName: string,
  indexName: string,
  query: IDBValidKey
): Promise<T[]> {
  const db = await openPOSDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).index(indexName).getAll(query);
    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
}
