// In-memory stand-in for chrome.storage, for tests only. Never imported by
// production code. Mirrors the promise-based MV3 shape closely enough that the
// data layer can run unchanged against it.

type StorageRecord = Record<string, unknown>;

export interface StorageArea {
  get(
    keys?: string | string[] | StorageRecord | null,
  ): Promise<StorageRecord>;
  set(items: StorageRecord): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface ChromeStorageStub {
  local: StorageArea;
  session: StorageArea;
}

function createArea(): StorageArea {
  let store: StorageRecord = {};

  return {
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
    async remove(keys) {
      const doomed = typeof keys === 'string' ? [keys] : keys;
      const next = { ...store };
      for (const key of doomed) delete next[key];
      store = next;
    },
  };
}

// local persists, session is memory-only — the stub keeps them separate so a
// test cannot pass by writing to the wrong one.
export function createChromeStorageStub(): ChromeStorageStub {
  return { local: createArea(), session: createArea() };
}
