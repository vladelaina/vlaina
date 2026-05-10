import { afterEach, describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { applyBlockMove } from './blockControlsMove';
import { getDraggableBlockRanges } from './blockControlsInteractions';
import { resolveBlockMoveContext } from './blockControlsMoveCore';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  await editor.create();
  return editor;
}

afterEach(() => {
  document.body.innerHTML = '';
});

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\n+$/, '');
}

function extractSemanticLines(markdown: string): string[] {
  return normalizeMarkdown(markdown)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => line.replace(/^\s*(?:[-+*]|\d+\.)\s+(?:\[(?: |x|X)\]\s+)?/, ''))
    .sort();
}

function expectSemanticContentPreserved(before: string, after: string): void {
  expect(extractSemanticLines(after)).toEqual(extractSemanticLines(before));
}

function expectSingleOccurrence(markdown: string, text: string): void {
  expect(markdown.match(new RegExp(text, 'g'))).toHaveLength(1);
}

function isCodeBlockRange(view: EditorView, range: { from: number }): boolean {
  try {
    return view.state.doc.resolve(range.from).nodeAfter?.type.name === 'code_block';
  } catch {
    return false;
  }
}

describe('applyBlockMove content integrity', () => {
  it('reorders top-level paragraphs without duplicating or dropping content', async () => {
    const markdown = 'A\n\nB\n\nC';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(applyBlockMove(view, [blocks[0]], view.state.doc.content.size)).toBe(true);
    expect(normalizeMarkdown(serializer(view.state.doc))).toBe('B\n\nC\n\nA');
    expectSemanticContentPreserved(markdown, serializer(view.state.doc));

    await editor.destroy();
  });

  it('reorders adjacent list items without changing the item set', async () => {
    const markdown = '- A\n- B\n- C';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(applyBlockMove(view, [blocks[0], blocks[1]], view.state.doc.content.size)).toBe(true);
    expectSemanticContentPreserved(markdown, serializer(view.state.doc));

    await editor.destroy();
  });

  it('moves a parent list item head without duplicating or losing its child item', async () => {
    const markdown = '- Parent\n  - Child\n- Sibling';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(applyBlockMove(view, [blocks[0]], view.state.doc.content.size)).toBe(true);
    const nextMarkdown = normalizeMarkdown(serializer(view.state.doc));
    expectSemanticContentPreserved(markdown, nextMarkdown);
    expectSingleOccurrence(nextMarkdown, 'Parent');
    expectSingleOccurrence(nextMarkdown, 'Child');
    expectSingleOccurrence(nextMarkdown, 'Sibling');

    await editor.destroy();
  });

  it('moves a parent block together with its nested child exactly once', async () => {
    const markdown = '- Parent\n  - Child\n- Sibling';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(applyBlockMove(view, [blocks[0], blocks[1]], view.state.doc.content.size)).toBe(true);
    const nextMarkdown = normalizeMarkdown(serializer(view.state.doc));
    expectSemanticContentPreserved(markdown, nextMarkdown);
    expectSingleOccurrence(nextMarkdown, 'Parent');
    expectSingleOccurrence(nextMarkdown, 'Child');
    expectSingleOccurrence(nextMarkdown, 'Sibling');
    expect(nextMarkdown).toMatch(/\n\s+(?:[-+*]|\d+\.)\s+Child/);

    await editor.destroy();
  });

  it('moves a parent block with multiple nested children without duplicating any child', async () => {
    const markdown = '- Parent\n  - Child A\n  - Child B\n- Sibling';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    expect(blocks).toHaveLength(4);
    expect(applyBlockMove(view, [blocks[0], blocks[1], blocks[2]], view.state.doc.content.size)).toBe(true);
    const nextMarkdown = normalizeMarkdown(serializer(view.state.doc));
    expectSemanticContentPreserved(markdown, nextMarkdown);
    expectSingleOccurrence(nextMarkdown, 'Parent');
    expectSingleOccurrence(nextMarkdown, 'Child A');
    expectSingleOccurrence(nextMarkdown, 'Child B');
    expectSingleOccurrence(nextMarkdown, 'Sibling');
    expect(nextMarkdown).toMatch(/\n\s+(?:[-+*]|\d+\.)\s+Child A/);
    expect(nextMarkdown).toMatch(/\n\s+(?:[-+*]|\d+\.)\s+Child B/);

    await editor.destroy();
  });

  it('moves mixed paragraph and list selections without changing semantic content', async () => {
    const markdown = 'Intro\n\nMiddle\n\n- Parent\n  - Child\n\nOutro';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    expect(blocks).toHaveLength(5);
    const draggedRanges = getDraggableBlockRanges(view, [blocks[1], blocks[2], blocks[3]]);
    const originalDraggedRanges = draggedRanges.map((range) => ({ ...range }));
    expect(resolveBlockMoveContext(view, draggedRanges, view.state.doc.content.size)).not.toBeNull();
    expect(draggedRanges).toEqual(originalDraggedRanges);

    expect(applyBlockMove(view, draggedRanges, view.state.doc.content.size)).toBe(true);
    const nextMarkdown = normalizeMarkdown(serializer(view.state.doc));
    expectSemanticContentPreserved(markdown, nextMarkdown);
    expectSingleOccurrence(nextMarkdown, 'Middle');
    expectSingleOccurrence(nextMarkdown, 'Parent');
    expectSingleOccurrence(nextMarkdown, 'Child');
    expectSingleOccurrence(nextMarkdown, 'Intro');
    expectSingleOccurrence(nextMarkdown, 'Outro');

    await editor.destroy();
  });

  it('drags a code block out of a list item without moving the list item', async () => {
    const markdown = '- Item\n  ```ts\n  console.log(1)\n  ```\n\nTail';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const codeBlock = blocks.find((range) => isCodeBlockRange(view, range));

    expect(codeBlock).toBeDefined();
    const draggedRanges = getDraggableBlockRanges(view, [codeBlock!]);
    expect(draggedRanges).toEqual([codeBlock]);

    expect(applyBlockMove(view, draggedRanges, view.state.doc.content.size)).toBe(true);
    const nextMarkdown = normalizeMarkdown(serializer(view.state.doc));
    expect(nextMarkdown).toContain('- Item');
    expect(nextMarkdown).toContain('Tail');
    expect(nextMarkdown).toContain('```ts\nconsole.log(1)\n```');
    expect(nextMarkdown.indexOf('- Item')).toBeLessThan(nextMarkdown.indexOf('Tail'));
    expect(nextMarkdown.indexOf('Tail')).toBeLessThan(nextMarkdown.indexOf('```ts'));

    await editor.destroy();
  });

  it('drags a whole list item with its code block when the list item range is selected', async () => {
    const markdown = '- Item\n  ```ts\n  console.log(1)\n  ```\n\nTail';
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const listItem = blocks.find((range) => {
      try {
        return view.state.doc.resolve(range.from).nodeAfter?.type.name === 'list_item';
      } catch {
        return false;
      }
    });

    expect(listItem).toBeDefined();
    const draggedRanges = getDraggableBlockRanges(view, [listItem!]);
    expect(draggedRanges).toEqual([listItem]);

    expect(applyBlockMove(view, draggedRanges, view.state.doc.content.size)).toBe(true);
    const nextMarkdown = normalizeMarkdown(serializer(view.state.doc));
    expect(nextMarkdown).toContain('Tail');
    expect(nextMarkdown).toContain('- Item');
    expect(nextMarkdown).toContain('```ts');
    expect(nextMarkdown).toContain('console.log(1)');
    expect(nextMarkdown.indexOf('Tail')).toBeLessThan(nextMarkdown.indexOf('- Item'));
    expect(nextMarkdown.indexOf('- Item')).toBeLessThan(nextMarkdown.indexOf('```ts'));

    await editor.destroy();
  });
});
