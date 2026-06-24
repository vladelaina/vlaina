import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { Decoration } from '@milkdown/kit/prose/view';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { atomicBlockKeyboardNavigationPlugin } from '../cursor/atomicBlockKeyboardNavigationPlugin';
import {
  changedRangeContainsDefinitionDescriptionParagraph,
  createDeflistDecorations,
  deflistPlugin,
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

async function createDefinitionListEditor() {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
    })
    .use(commonmark);

  for (const plugin of deflistPlugin) {
    editor.use(plugin);
  }

  await editor.create();
  return editor;
}

async function createDefinitionListEditorWithKeyboardNavigation() {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
    })
    .use(commonmark);

  for (const plugin of deflistPlugin) {
    editor.use(plugin);
  }
  editor.use(atomicBlockKeyboardNavigationPlugin);

  await editor.create();
  return editor;
}

function pressKey(view: EditorView, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    if (handled) return handled;
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });

  return event;
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

  it('keeps a text cursor when deleting from an empty definition description', async () => {
    const editor = await createDefinitionListEditorWithKeyboardNavigation();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const definitionList = schema.nodes.definition_list.create(null, [
      schema.nodes.definition_term.create(null, schema.text('Term')),
      schema.nodes.definition_desc.create(null, [
        schema.nodes.paragraph.create(),
      ]),
    ]);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [
      definitionList,
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]));

    let emptyDescriptionPos: number | null = null;
    view.state.doc.descendants((node, pos) => {
      if (emptyDescriptionPos !== null) return false;
      if (node.type.name === 'paragraph' && node.content.size === 0) {
        emptyDescriptionPos = pos + 1;
        return false;
      }
      return true;
    });
    expect(emptyDescriptionPos).toBeTypeOf('number');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyDescriptionPos!)));

    pressKey(view, 'Delete');

    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);

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

  it('maps existing decorations when typing an ordinary colon in body text', async () => {
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

  it('treats exhausted changed-range scans as affecting definition list decorations', () => {
    let scanned = 0;
    const doc = {
      content: { size: 300 },
      nodesBetween: (_from: number, _to: number, callback: (node: any) => boolean | void) => {
        for (let index = 0; index < 5; index += 1) {
          scanned += 1;
          const shouldContinue = callback({
            content: { size: 0 },
            type: { name: 'text' },
          });
          if (shouldContinue === false) break;
        }
      },
    } as unknown as ProseMirrorNode;
    const tr = {
      mapping: {
        maps: [{
          forEach: (callback: (
            oldStart: number,
            oldEnd: number,
            newStart: number,
            newEnd: number,
          ) => void) => callback(0, 200, 0, 200),
        }],
      },
    };

    expect(changedRangeContainsDefinitionDescriptionParagraph(doc, tr, 1)).toBe(true);
    expect(scanned).toBe(2);
  });
});

describe('deflistPlugin markdown serialization', () => {
  it('serializes multi-paragraph definition descriptions without nesting blocks', async () => {
    const editor = await createDefinitionListEditor();
    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const { schema } = view.state;
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.definition_list.create(null, [
        schema.nodes.definition_term.create(null, schema.text('Term')),
        schema.nodes.definition_desc.create(null, [
          schema.nodes.paragraph.create(null, schema.text('First')),
          schema.nodes.paragraph.create(null, schema.text('Second')),
        ]),
      ]),
    ]);

    expect(serializer(doc).trimEnd()).toBe(['Term', '', ': First', '', 'Second'].join('\n'));

    await editor.destroy();
  });
});
