import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { Decoration } from '@milkdown/kit/prose/view';
import { createDeflistDecorations } from './deflistPlugin';

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
});
