import { describe, expect, it, vi } from 'vitest';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { Serializer } from '@milkdown/kit/transformer';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { serializeSelectedBlocksToText } from './blockSelectionCommands';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';

function createMockState(): EditorState {
  const doc = {
    cut(from: number, to: number) {
      return { range: `${from}-${to}` };
    },
    slice(from: number, to: number) {
      const text = `plain-${from}-${to}`;
      return {
        content: {
          forEach(callback: (node: { isText: boolean; text: string }) => void) {
            callback({ isText: true, text });
          },
        },
      };
    },
  };

  return { doc } as unknown as EditorState;
}

describe('serializeSelectedBlocksToText', () => {
  it('prefers markdown serializer and keeps markdown syntax text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => `## ${doc.range}`);

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 5, to: 8 },
        { from: 1, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('## 1-4\n\n## 5-8');
    expect(markdownSerializer.mock.calls.map(([doc]) => (doc as { range: string }).range)).toEqual([
      '1-4',
      '5-8',
    ]);
  });

  it('falls back to plain text when markdown serializer throws', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => {
      throw new Error('serializer unavailable');
    });

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 2, to: 6 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('plain-2-6');
  });

  it('normalizes empty markdown block serialized as <br /> to empty text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => '<br />');

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 3, to: 4 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('\n');
  });

  it('keeps empty block gaps when copying multiple markdown blocks', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return '# Title';
      if (doc.range === '3-4') return '<br />';
      return '- item';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 5, to: 6 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('# Title\n\n- item');
  });

  it('serializes leading frontmatter block selections back to markdown fences', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return '```yaml-frontmatter\ntitle: demo\n```';
      return 'Body';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('---\ntitle: demo\n---\nBody');
  });

  it('keeps a single blank line gap when copying actual paragraph blocks', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '1\n\n2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '1\n\n2'
    );

    await editor.destroy();
  });

  it('keeps markdown semantics for bullet lists separated by a single blank line', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- A\n\n- B');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '- A\n- B'
    );

    await editor.destroy();
  });

  it('keeps markdown semantics for task lists separated by a single blank line', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] A\n\n- [ ] B');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '- [ ] A\n- [ ] B'
    );

    await editor.destroy();
  });

  it('copies a single task block without task markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] todo');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      'todo'
    );

    await editor.destroy();
  });

  it('copies a single nested task block without markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] 1\n  - [ ] 2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(2);
    expect(serializeSelectedBlocksToText(view.state, [blocks[1]], { markdownSerializer: serializer })).toBe(
      '2'
    );

    await editor.destroy();
  });
});
