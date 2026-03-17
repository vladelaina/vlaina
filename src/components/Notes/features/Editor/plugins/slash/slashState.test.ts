import { describe, expect, it } from 'vitest';
import { createSlashState, deriveSlashState } from './slashState';

function createSelection(textBefore: string, pos = textBefore.length) {
  return {
    $from: {
      parentOffset: textBefore.length,
      pos,
      parent: {
        textBetween: () => textBefore,
      },
    },
  } as any;
}

function createTransaction(options: {
  selectionText: string;
  selectionPos?: number;
  docChanged?: boolean;
  selectionSet?: boolean;
  meta?: Record<string, unknown>;
}) {
  const metaMap = options.meta ?? {};

  return {
    docChanged: options.docChanged ?? false,
    selectionSet: options.selectionSet ?? false,
    selection: createSelection(options.selectionText, options.selectionPos),
    getMeta: (key: unknown) => metaMap[String((key as { key?: string }).key ?? 'slashMenu')] ?? null,
  } as any;
}

describe('deriveSlashState', () => {
  it('opens from plugin meta', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: '/',
        meta: { slashMenu: { isOpen: true, query: '', selectedIndex: 0 } },
      }),
      createSlashState()
    );

    expect(next.isOpen).toBe(true);
  });

  it('closes when selection moves away from slash query without doc change', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: 'plain text',
        selectionSet: true,
      }),
      {
        isOpen: true,
        query: 'todo',
        selectedIndex: 0,
      }
    );

    expect(next).toEqual(createSlashState());
  });

  it('updates query when selection changes within slash query without doc change', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: '/hea',
        selectionSet: true,
      }),
      {
        isOpen: true,
        query: 'he',
        selectedIndex: 4,
      }
    );

    expect(next.isOpen).toBe(true);
    expect(next.query).toBe('hea');
    expect(next.selectedIndex).toBeGreaterThanOrEqual(0);
  });

  it('closes when query no longer matches any slash item', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: '/zzzz-no-match',
        docChanged: true,
      }),
      {
        isOpen: true,
        query: 'z',
        selectedIndex: 0,
      }
    );

    expect(next).toEqual(createSlashState());
  });
});
