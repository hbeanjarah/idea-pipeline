// In-memory stand-in for chrome.storage.local, for tests only. Never imported
// by production code. Mirrors the promise-based MV3 shape (get/set) closely
// enough that the data layer can run unchanged against it.

type StorageRecord = Record<string, unknown>;

export interface ChromeStorageStub {
  local: {
    get(
      keys?: string | string[] | StorageRecord | null,
    ): Promise<StorageRecord>;
    set(items: StorageRecord): Promise<void>;
  };
}

export function createChromeStorageStub(): ChromeStorageStub {
  let store: StorageRecord = {};

  return {
    local: {
      async get(keys) {
        if (keys === null || keys === undefined) {
          return { ...store };
        }
        if (typeof keys === 'string') {
          return keys in store ? { [keys]: store[keys] } : {};
        }
        if (Array.isArray(keys)) {
          const result: StorageRecord = {};
          for (const key of keys) {
            if (key in store) result[key] = store[key];
          }
          return result;
        }
        // Object form: each key maps to a default returned when absent.
        const result: StorageRecord = {};
        for (const [key, fallback] of Object.entries(keys)) {
          result[key] = key in store ? store[key] : fallback;
        }
        return result;
      },
      async set(items) {
        store = { ...store, ...items };
      },
    },
  };
}
