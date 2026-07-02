import { describe, expect, it } from 'vitest';

import { WebAdapter, MAX_WEB_ADAPTER_LIST_ENTRIES } from './WebAdapter';

interface StoredFileFixture {
  path: string;
  content: string;
  isBinary: false;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

function createRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  } as unknown as IDBRequest<T>;
  queueMicrotask(() => request.onsuccess?.(new Event('success') as Event & { target: IDBRequest<T> }));
  return request;
}

function createCursorRequest<T>(values: T[]): IDBRequest<IDBCursorWithValue | null> {
  const request = {
    result: null,
    error: null,
    onsuccess: null,
    onerror: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  } as unknown as IDBRequest<IDBCursorWithValue | null>;
  let index = 0;

  const advance = () => {
    queueMicrotask(() => {
      const value = values[index];
      index += 1;
      Object.defineProperty(request, 'result', {
        configurable: true,
        value: value === undefined
          ? null
          : {
              value,
              continue: advance,
            },
      });
      request.onsuccess?.(new Event('success') as Event & { target: IDBRequest<IDBCursorWithValue | null> });
    });
  };

  advance();
  return request;
}

function installDatabase(
  adapter: WebAdapter,
  files: StoredFileFixture[],
  options: { cursor: boolean },
) {
  const valuesByStore = {
    files,
    directories: [],
  };
  const adapterWithDb = adapter as unknown as {
    getDB: () => Promise<IDBDatabase>;
  };
  adapterWithDb.getDB = async () => ({
    transaction: (storeName: keyof typeof valuesByStore) => ({
      objectStore: () => {
        const values = valuesByStore[storeName];
        return {
          getAll: (_query?: IDBKeyRange | IDBValidKey | null, count?: number) =>
            createRequest(typeof count === 'number' ? values.slice(0, count) : values),
          ...(options.cursor ? { openCursor: () => createCursorRequest(values) } : {}),
        };
      },
    }),
  }) as unknown as IDBDatabase;
}

function file(path: string, index: number): StoredFileFixture {
  return {
    path,
    content: 'x',
    isBinary: false,
    size: 1,
    modifiedAt: index,
    createdAt: index,
  };
}

describe('WebAdapter prefix listing scans', () => {
  it('keeps markdown files beyond the fallback getAll count cap visible', async () => {
    const adapter = new WebAdapter();
    installDatabase(adapter, [
      ...Array.from({ length: MAX_WEB_ADAPTER_LIST_ENTRIES }, (_value, index) =>
        file(`/notesRoot/asset-${String(index).padStart(5, '0')}.png`, index)
      ),
      file('/notesRoot/late.md', 1),
    ], { cursor: false });

    const entries = await adapter.listDir('/notesRoot', { includeHidden: true });

    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'late.md', path: '/notesRoot/late.md', isFile: true }),
    ]));
    expect(entries).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'asset-19999.png' }),
    ]));
  });

  it('keeps markdown files beyond the cursor prefix scan cap visible', async () => {
    const adapter = new WebAdapter();
    installDatabase(adapter, [
      ...Array.from({ length: MAX_WEB_ADAPTER_LIST_ENTRIES }, (_value, index) =>
        file(`/notesRoot/asset-${String(index).padStart(5, '0')}.png`, index)
      ),
      file('/notesRoot/late.md', 1),
    ], { cursor: true });

    const entries = await adapter.listDir('/notesRoot', { includeHidden: true });

    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'late.md', path: '/notesRoot/late.md', isFile: true }),
    ]));
    expect(entries).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'asset-19999.png' }),
    ]));
  });
});
