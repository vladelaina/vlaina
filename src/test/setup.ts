import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const emptyRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
};

if (typeof Range !== 'undefined') {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => emptyRect,
  });

  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () =>
      Object.assign([emptyRect], {
        item: (index: number) => (index === 0 ? emptyRect : null),
      }),
  });
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class OffscreenCanvasMock {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 }),
    };
  }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('OffscreenCanvas', OffscreenCanvasMock);

const indexedDbObjectStores = new Map<string, Map<string, unknown>>();
const indexedDbKeyPaths = new Map<string, string>();

vi.stubGlobal('IDBKeyRange', {
  bound: (lower: IDBValidKey, upper: IDBValidKey) => ({
    lower,
    upper,
    includes: (key: IDBValidKey) => String(key) >= String(lower) && String(key) <= String(upper),
  }),
});

function dispatchIndexedDbSuccess<T>(request: IDBRequest<T>, result: T) {
  queueMicrotask(() => {
    Object.defineProperty(request, 'result', {
      configurable: true,
      value: result,
    });
    request.onsuccess?.(new Event('success') as Event & { target: IDBRequest<T> });
  });
}

function dispatchIndexedDbError<T>(request: IDBRequest<T>, error: Error) {
  queueMicrotask(() => {
    Object.defineProperty(request, 'error', {
      configurable: true,
      value: error,
    });
    request.onerror?.(new Event('error') as Event & { target: IDBRequest<T> });
  });
}

function createIndexedDbRequest<T>(operation: () => T): IDBRequest<T> {
  const request = {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as IDBRequest<T>;

  queueMicrotask(() => {
    try {
      dispatchIndexedDbSuccess(request, operation());
    } catch (error) {
      dispatchIndexedDbError(request, error instanceof Error ? error : new Error(String(error)));
    }
  });

  return request;
}

function createIndexedDbStore(name: string): IDBObjectStore {
  const entries = () => {
    let store = indexedDbObjectStores.get(name);
    if (!store) {
      store = new Map();
      indexedDbObjectStores.set(name, store);
    }
    return store;
  };

  const filterByRange = (range?: IDBKeyRange | IDBValidKey | null) => {
    const values = [...entries().entries()];
    if (!range) return values;
    if (typeof range === 'object' && 'includes' in range) {
      return values.filter(([key]) => (range as IDBKeyRange).includes(key));
    }
    return values.filter(([key]) => key === String(range));
  };

  return {
    get: (key: IDBValidKey) => createIndexedDbRequest(() => entries().get(String(key))),
    getAll: (query?: IDBKeyRange | IDBValidKey | null, count?: number) => createIndexedDbRequest(() => {
      const values = filterByRange(query).map(([, value]) => value);
      return typeof count === 'number' ? values.slice(0, count) : values;
    }),
    put: (value: unknown) => createIndexedDbRequest(() => {
      const keyPath = indexedDbKeyPaths.get(name);
      if (!keyPath || typeof value !== 'object' || value === null || !(keyPath in value)) {
        throw new Error(`Missing IndexedDB keyPath "${keyPath ?? ''}" for store "${name}"`);
      }
      entries().set(String((value as Record<string, unknown>)[keyPath]), value);
      return undefined;
    }),
    delete: (key: IDBValidKey) => createIndexedDbRequest(() => {
      entries().delete(String(key));
      return undefined;
    }),
  } as unknown as IDBObjectStore;
}

function createIndexedDbDatabase(): IDBDatabase {
  return {
    objectStoreNames: {
      contains: (name: string) => indexedDbKeyPaths.has(name),
    },
    createObjectStore: (name: string, options?: IDBObjectStoreParameters) => {
      indexedDbKeyPaths.set(name, String(options?.keyPath ?? 'id'));
      if (!indexedDbObjectStores.has(name)) {
        indexedDbObjectStores.set(name, new Map());
      }
      return createIndexedDbStore(name);
    },
    transaction: (storeName: string) => ({
      objectStore: (name: string) => {
        if (name !== storeName || !indexedDbKeyPaths.has(name)) {
          throw new Error(`IndexedDB object store not found: ${name}`);
        }
        return createIndexedDbStore(name);
      },
    }),
  } as unknown as IDBDatabase;
}

const indexedDbDatabase = createIndexedDbDatabase();

vi.stubGlobal('indexedDB', {
  open: () => {
    const needsUpgrade = !indexedDbKeyPaths.has('files') || !indexedDbKeyPaths.has('directories');
    const request = {
      result: indexedDbDatabase,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as IDBOpenDBRequest;

    queueMicrotask(() => {
      if (needsUpgrade) {
        request.onupgradeneeded?.({ target: request } as unknown as IDBVersionChangeEvent);
      }
      request.onsuccess?.(new Event('success') as Event & { target: IDBOpenDBRequest });
    });

    return request;
  },
} as unknown as IDBFactory);

function clearIndexedDbMockData() {
  indexedDbObjectStores.forEach((store) => store.clear());
}

function ensureGlobalEventListeners() {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof globalThis.addEventListener === 'undefined') {
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      writable: true,
      value: window.addEventListener.bind(window),
    });
  }
  if (typeof globalThis.removeEventListener === 'undefined') {
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      writable: true,
      value: window.removeEventListener.bind(window),
    });
  }
}

function ensureDomConstructors() {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.HTMLTableRowElement !== 'undefined') {
    vi.stubGlobal('HTMLTableRowElement', window.HTMLTableRowElement);
  }
  if (typeof window.HTMLTableCellElement !== 'undefined') {
    vi.stubGlobal('HTMLTableCellElement', window.HTMLTableCellElement);
  }
}

ensureGlobalEventListeners();
ensureDomConstructors();
const unstubAllGlobals = vi.unstubAllGlobals.bind(vi);
vi.unstubAllGlobals = () => {
  const result = unstubAllGlobals();
  ensureGlobalEventListeners();
  ensureDomConstructors();
  return result;
};

beforeEach(() => {
  clearIndexedDbMockData();
  ensureGlobalEventListeners();
  ensureDomConstructors();
});

afterEach(() => {
  ensureGlobalEventListeners();
  ensureDomConstructors();
});

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 }),
    }),
  });
}
