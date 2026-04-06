import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import {
  buildEditorFindMatches,
  normalizeEditorFindActiveIndex,
  resolveEditorFindIndexAfterDocChange,
  resolveEditorFindStartIndex,
} from './editorFindMatches';

type MockNode = {
  isText?: boolean;
  isTextblock?: boolean;
  text?: string;
  children?: MockNode[];
  forEach: (callback: (child: MockNode, offset: number) => void) => void;
};

function createNode(config: Omit<MockNode, 'forEach'>): MockNode {
  return {
    ...config,
    forEach(callback) {
      let offset = 0;
      for (const child of config.children ?? []) {
        callback(child, offset);
        offset += child.isText ? child.text?.length ?? 0 : 2;
      }
    },
  };
}

function text(value: string): MockNode {
  return createNode({
    isText: true,
    text: value,
  });
}

function paragraph(...children: MockNode[]): MockNode {
  return createNode({
    isTextblock: true,
    children,
  });
}

function doc(...children: MockNode[]): MockNode {
  return createNode({
    children,
  });
}

function findSubstringRange(docNode: any, query: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  docNode.descendants((node: any, pos: number) => {
    if (resolved) {
      return false;
    }

    if (!node.isText || typeof node.text !== 'string') {
      return;
    }

    const index = node.text.indexOf(query);
    if (index === -1) {
      return;
    }

    resolved = {
      from: pos + index,
      to: pos + index + query.length,
    };
    return false;
  });

  if (!resolved) {
    throw new Error(`Unable to resolve substring range for "${query}"`);
  }

  return resolved;
}

describe('editorFindMatches', () => {
  it('matches across adjacent text nodes inside the same text block', () => {
    const matches = buildEditorFindMatches(
      doc(
        paragraph(
          text('hel'),
          text('lo world'),
        ),
      ) as never,
      'hello',
    );

    expect(matches).toEqual([
      {
        from: 1,
        to: 6,
        ranges: [
          { from: 1, to: 4 },
          { from: 4, to: 6 },
        ],
      },
    ]);
  });

  it('keeps matches scoped to each text block', () => {
    const matches = buildEditorFindMatches(
      doc(
        paragraph(text('hello')),
        paragraph(text('world')),
      ) as never,
      'ow',
    );

    expect(matches).toHaveLength(0);
  });

  it('starts from the nearest match after the current selection and wraps indices', () => {
    const matches = buildEditorFindMatches(
      doc(
        paragraph(text('alpha beta beta')),
      ) as never,
      'beta',
    );

    expect(resolveEditorFindStartIndex(matches, 8)).toBe(0);
    expect(resolveEditorFindStartIndex(matches, 13)).toBe(1);
    expect(normalizeEditorFindActiveIndex(-1, matches.length)).toBe(1);
    expect(normalizeEditorFindActiveIndex(2, matches.length)).toBe(0);
  });

  it('keeps the closest active match after document changes', () => {
    const previousMatches = buildEditorFindMatches(
      doc(paragraph(text('beta gamma beta'))) as never,
      'beta',
    );
    const nextMatches = buildEditorFindMatches(
      doc(paragraph(text('gamma beta delta'))) as never,
      'beta',
    );

    expect(
      resolveEditorFindIndexAfterDocChange(nextMatches, previousMatches[1], 1),
    ).toBe(0);
  });

  it('maps chinese matches to actual prose positions without shifting to the next character', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '你好世界');
      })
      .use(commonmark);

    await editor.create();

    try {
      const view = editor.ctx.get(editorViewCtx);
      const range = findSubstringRange(view.state.doc, '你');

      expect(buildEditorFindMatches(view.state.doc, '你')).toEqual([
        {
          from: range.from,
          to: range.to,
          ranges: [range],
        },
      ]);
    } finally {
      await editor.destroy();
    }
  });
});
