import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const DATABASE_NAME = 'clipit-query-cache';
const STORE_NAME = 'cache';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

const indexedDbStorage = typeof window === 'undefined' || !window.indexedDB
  ? undefined
  : {
      getItem: async (key: string): Promise<string | null> => {
        try {
          return (await withStore('readonly', (store) => store.get(key))) ?? null;
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          await withStore('readwrite', (store) => store.put(value, key));
        } catch {
          // Caching is an enhancement; a full quota or private-browser mode
          // must never prevent the app itself from working.
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          await withStore('readwrite', (store) => store.delete(key));
        } catch {
          // See setItem above.
        }
      },
    };

export const queryPersister = createAsyncStoragePersister({
  storage: indexedDbStorage,
  key: 'clipit-query-cache-v1',
  throttleTime: 1000,
});
