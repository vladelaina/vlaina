import { afterEach, describe, expect, it } from 'vitest';
import { Editor, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import {
  collectSelectableBlockRanges,
  resolveInlineCaretRange,
} from './blockUnitRangeCollection';

describe('inline caret range contract', () => {
  const editors: Editor[] = [];

  afterEach(async () => {
    await Promise.all(editors.splice(0).map((editor) => editor.destroy()));
  });

  it('separates exact hard-break line edges from structural block boundaries in a real document', async () => {
    const editor = Editor.make().use(commonmark).use(gfm);
    editors.push(editor);
    await editor.create();
    const schema = editor.ctx.get(editorViewCtx).state.schema;
    const paragraph = schema.nodes.paragraph;
    const hardbreak = schema.nodes.hardbreak;
    const bulletList = schema.nodes.bullet_list;
    const listItem = schema.nodes.list_item;
    const hr = schema.nodes.hr;
    if (!paragraph || !hardbreak || !bulletList || !listItem || !hr) {
      throw new Error('Missing commonmark schema nodes');
    }

    const plainNode = paragraph.create(null, schema.text('Plain'));
    const hardBreakNode = paragraph.create(null, [
      schema.text('First'),
      hardbreak.create(),
      schema.text('Middle'),
      hardbreak.create(),
      schema.text('Final'),
    ]);
    const listNode = bulletList.create(null, [
      listItem.create(null, paragraph.create(null, schema.text('List'))),
    ]);
    const emptyNode = paragraph.create();
    const hrNode = hr.create();
    const doc = schema.nodes.doc.create(null, [plainNode, hardBreakNode, listNode, emptyNode, hrNode]);
    const ranges = collectSelectableBlockRanges(doc);
    const hardBreakBlock = {
      from: plainNode.nodeSize,
      to: plainNode.nodeSize + hardBreakNode.nodeSize,
    };
    const listBlock = {
      from: hardBreakBlock.to,
      to: hardBreakBlock.to + listNode.nodeSize,
    };
    const emptyBlock = {
      from: listBlock.to,
      to: listBlock.to + emptyNode.nodeSize,
    };
    const hrBlock = {
      from: emptyBlock.to,
      to: emptyBlock.to + hrNode.nodeSize,
    };

    const hardBreakPositions: number[] = [];
    doc.nodesBetween(hardBreakBlock.from, hardBreakBlock.to, (node, pos) => {
      if (node.type.name === 'hardbreak' || node.type.name === 'hard_break') {
        hardBreakPositions.push(pos);
      }
    });
    expect(hardBreakPositions).toHaveLength(2);

    const lineRanges = ranges.filter((range) => (
      range.from >= hardBreakBlock.from + 1 && range.to <= hardBreakBlock.to - 1
    ));
    expect(lineRanges).toHaveLength(3);
    expect(lineRanges.map((range) => resolveInlineCaretRange(doc, range))).toEqual([
      { from: hardBreakBlock.from + 1, to: hardBreakPositions[0] },
      { from: hardBreakPositions[0] + 1, to: hardBreakPositions[1] },
      { from: hardBreakPositions[1] + 1, to: hardBreakBlock.to - 1 },
    ]);

    const plainRange = ranges.find((range) => range.from === 0 && range.to === plainNode.nodeSize);
    const listRange = ranges.find((range) => range.from > listBlock.from && range.to < listBlock.to);
    const emptyRange = ranges.find((range) => (
      range.from === emptyBlock.from && range.to === emptyBlock.to
    ));
    const hrRange = ranges.find((range) => (
      range.from === hrBlock.from && range.to === hrBlock.to
    ));
    expect([plainRange, listRange, emptyRange, hrRange]).not.toContain(undefined);
    expect([plainRange, listRange, emptyRange, hrRange].map((range) => (
      resolveInlineCaretRange(doc, range!)
    ))).toEqual([null, null, null, null]);
  });

  it('keeps an empty visual line between consecutive hard breaks addressable', async () => {
    const editor = Editor.make().use(commonmark).use(gfm);
    editors.push(editor);
    await editor.create();
    const schema = editor.ctx.get(editorViewCtx).state.schema;
    const paragraph = schema.nodes.paragraph;
    const hardbreak = schema.nodes.hardbreak;
    if (!paragraph || !hardbreak) throw new Error('Missing hard-break schema nodes');

    const paragraphNode = paragraph.create(null, [
      schema.text('First'),
      hardbreak.create(),
      hardbreak.create(),
      schema.text('Final'),
    ]);
    const doc = schema.nodes.doc.create(null, paragraphNode);
    const hardBreakPositions: number[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === 'hardbreak' || node.type.name === 'hard_break') {
        hardBreakPositions.push(pos);
      }
    });

    const caretRanges = collectSelectableBlockRanges(doc).map((range) => (
      resolveInlineCaretRange(doc, range)
    ));
    expect(caretRanges).toEqual([
      { from: 1, to: hardBreakPositions[0] },
      { from: hardBreakPositions[0] + 1, to: hardBreakPositions[1] },
      { from: hardBreakPositions[1] + 1, to: paragraphNode.nodeSize - 1 },
    ]);
    expect(caretRanges[1]?.from).toBe(caretRanges[1]?.to);
  });
});
