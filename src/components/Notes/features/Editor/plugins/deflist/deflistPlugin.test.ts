import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { Decoration } from '@milkdown/kit/prose/view';
import {
  createDeflistDecorations,
  transactionMayAffectDeflistDecorations,
} from './deflistPlugin';

async function createEditor(markdown = '') {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark);

  await editor.create();
  return editor;
}

function getDecorationClasses(doc: ProseMirrorNode): string[] {
  return createDeflistDecorations(doc)
    .find()
    .map((decoration: Decoration) => (decoration.type as any).attrs?.class);
}

function findTextPosition(doc: ProseMirrorNode, text: string, edge: 'start' | 'end'): number {
  let result = -1;
  doc.descendants((node, pos) => {
    if (!node.isText) {
      return true;
    }
    const index = (node.text ?? '').indexOf(text);
    if (index < 0) {
      return true;
    }
    result = pos + index + (edge === 'end' ? text.length : 0);
    return false;
  });

  if (result < 0) {
    throw new Error(`Text not found: ${text}`);
  }
  return result;
}

describe('deflistPlugin visual decorations', () => {
  it('decorates short term and description paragraphs', async () => {
    const editor = await createEditor();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph;

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [
      paragraph.create(null, schema.text('Term')),
      paragraph.create(null, schema.text(': Definition')),
    ]));

    expect(getDecorationClasses(view.state.doc)).toEqual([
      'editor-dl-term',
      'editor-dl-desc',
    ]);

    await editor.destroy();
  });

  it('skips long preceding paragraphs as definition terms', async () => {
    const editor = await createEditor();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph;

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [
      paragraph.create(null, schema.text('a'.repeat(81))),
      paragraph.create(null, schema.text(': Definition')),
    ]));

    expect(getDecorationClasses(view.state.doc)).toEqual([]);

    await editor.destroy();
  });

  it('adds a gap-fix class when an empty paragraph separates the term and description', async () => {
    const editor = await createEditor();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph;

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [
      paragraph.create(null, schema.text('Term')),
      paragraph.create(),
      paragraph.create(null, schema.text(': Definition')),
    ]));

    expect(getDecorationClasses(view.state.doc)).toEqual([
      'editor-dl-term',
      'editor-dl-desc editor-dl-gap-fix',
    ]);

    await editor.destroy();
  });

  it('caps visual definition list decorations per document', async () => {
    const editor = await createEditor();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph;
    const nodes = Array.from({ length: 505 }, (_, index) => [
      paragraph.create(null, schema.text(`Term ${index}`)),
      paragraph.create(null, schema.text(`: Definition ${index}`)),
    ]).flat();

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));

    expect(createDeflistDecorations(view.state.doc).find()).toHaveLength(1000);

    await editor.destroy();
  });

  it('maps existing decorations for unrelated typing far from definition list blocks', async () => {
    const editor = await createEditor([
      'Term',
      '',
      ': Definition',
      '',
      'Filler one',
      '',
      'Filler two',
      '',
      'Filler three',
      '',
      'Target paragraph',
    ].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const previous = createDeflistDecorations(view.state.doc);
    const tr = view.state.tr.insertText(
      ' smooth input',
      findTextPosition(view.state.doc, 'Target paragraph', 'end'),
    );

    expect(previous.find()).toHaveLength(2);
    expect(transactionMayAffectDeflistDecorations(previous, tr, tr.doc)).toBe(false);

    await editor.destroy();
  });

  it('maps existing decorations for ordinary inline colon typing', async () => {
    const editor = await createEditor([
      'Term',
      '',
      ': Definition',
      '',
      'Filler one',
      '',
      'Filler two',
      '',
      'Filler three',
      '',
      'Target paragraph',
    ].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const previous = createDeflistDecorations(view.state.doc);
    const tr = view.state.tr.insertText(
      ':',
      findTextPosition(view.state.doc, 'Target paragraph', 'end'),
    );

    expect(previous.find()).toHaveLength(2);
    expect(transactionMayAffectDeflistDecorations(previous, tr, tr.doc)).toBe(false);

    await editor.destroy();
  });

  it('rebuilds decorations when typing a definition description prefix', async () => {
    const editor = await createEditor([
      'Term',
      '',
      'Definition candidate',
    ].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const previous = createDeflistDecorations(view.state.doc);
    const tr = view.state.tr.insertText(
      ': ',
      findTextPosition(view.state.doc, 'Definition candidate', 'start'),
    );

    expect(transactionMayAffectDeflistDecorations(previous, tr, tr.doc)).toBe(true);

    await editor.destroy();
  });
});
