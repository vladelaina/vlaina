import { describe, expect, it } from 'vitest';
import { slashPluginKey } from './slashPluginKey';
import {
  canOpenSlashMenuFromSelection,
  createSlashState,
  deriveSlashState,
} from './slashState';

function createSelection(
  textBefore: string,
  pos = textBefore.length,
  options: { empty?: boolean; isTextblock?: boolean; isCode?: boolean } = {}
) {
  return {
    empty: options.empty ?? true,
    $from: {
      parentOffset: textBefore.length,
      pos,
      parent: {
        isTextblock: options.isTextblock ?? true,
        type: { spec: { code: options.isCode ?? false } },
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
        meta: {
          [slashPluginKey.key]: { isOpen: true, query: '', selectedIndex: 0 },
        },
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

  it('resets the selected item when the query changes', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: '/h',
        docChanged: true,
      }),
      {
        isOpen: true,
        query: '',
        selectedIndex: 5,
      }
    );

    expect(next.isOpen).toBe(true);
    expect(next.query).toBe('h');
    expect(next.selectedIndex).toBe(0);
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

  it('closes after whitespace in the slash query', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: '/h ',
        docChanged: true,
      }),
      {
        isOpen: true,
        query: 'h',
        selectedIndex: 0,
      }
    );

    expect(next).toEqual(createSlashState());
  });

  it('does not track slashes inside words or urls', () => {
    const next = deriveSlashState(
      createTransaction({
        selectionText: 'https://example.com',
        docChanged: true,
      }),
      {
        isOpen: true,
        query: '',
        selectedIndex: 0,
      }
    );

    expect(next).toEqual(createSlashState());
  });
});

describe('canOpenSlashMenuFromSelection', () => {
  it('opens at the start of a text block or after whitespace', () => {
    expect(canOpenSlashMenuFromSelection(createSelection(''))).toBe(true);
    expect(canOpenSlashMenuFromSelection(createSelection('hello '))).toBe(true);
  });

  it('does not open inside words, urls, code blocks, or range selections', () => {
    expect(canOpenSlashMenuFromSelection(createSelection('hello'))).toBe(false);
    expect(canOpenSlashMenuFromSelection(createSelection('https:/'))).toBe(false);
    expect(canOpenSlashMenuFromSelection(createSelection('', 0, { isCode: true }))).toBe(false);
    expect(canOpenSlashMenuFromSelection(createSelection('', 0, { empty: false }))).toBe(false);
  });
});
