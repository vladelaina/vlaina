import { describe, expect, it } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  calloutPlugin,
  handleCalloutModEnterExit,
  handleEmptyCalloutExit,
  serializeCalloutToMarkdown,
} from './calloutPlugin';

function createEditor(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(calloutPlugin);
}

function createRecorder() {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const state = {
    openNode: (...args: unknown[]) => {
      calls.push({ method: 'openNode', args });
      return state;
    },
    addNode: (...args: unknown[]) => {
      calls.push({ method: 'addNode', args });
      return state;
    },
    next: (...args: unknown[]) => {
      calls.push({ method: 'next', args });
      return state;
    },
    closeNode: (...args: unknown[]) => {
      calls.push({ method: 'closeNode', args });
      return state;
    },
  };

  return { calls, state };
}

describe('callout markdown serialization', () => {
  it('preserves alignment for the first paragraph', () => {
    const { calls, state } = createRecorder();
    const firstParagraphContent = { id: 'first-paragraph-content', size: 1 };
    const headingNode = { type: { name: 'heading' }, attrs: { level: 2 }, content: null };
    const firstParagraph = {
      type: { name: 'paragraph' },
      attrs: { align: 'center' },
      content: firstParagraphContent,
    };

    serializeCalloutToMarkdown(state, {
      attrs: {
        icon: { type: 'emoji', value: '💡' },
        backgroundColor: 'yellow',
      },
      firstChild: firstParagraph,
      childCount: 2,
      child: (index: number) => [firstParagraph, headingNode][index],
      content: null,
    });

    expect(calls).toEqual([
      { method: 'openNode', args: ['blockquote'] },
      { method: 'openNode', args: ['paragraph'] },
      { method: 'addNode', args: ['text', undefined, '💡 '] },
      { method: 'next', args: [firstParagraphContent] },
      { method: 'closeNode', args: [] },
      { method: 'addNode', args: ['html', undefined, '<!--align:center-->'] },
      { method: 'next', args: [headingNode] },
      { method: 'closeNode', args: [] },
    ]);
  });

  it('adds a leading emoji paragraph when the first child is not a paragraph', () => {
    const { calls, state } = createRecorder();
    const allContent = { id: 'all-content' };
    const headingNode = { type: { name: 'heading' }, attrs: { level: 2 }, content: null };

    serializeCalloutToMarkdown(state, {
      attrs: {
        icon: { type: 'emoji', value: '💡' },
        backgroundColor: 'yellow',
      },
      firstChild: headingNode,
      childCount: 1,
      child: () => headingNode,
      content: allContent,
    });

    expect(calls).toEqual([
      { method: 'openNode', args: ['blockquote'] },
      { method: 'openNode', args: ['paragraph'] },
      { method: 'addNode', args: ['text', undefined, '💡'] },
      { method: 'closeNode', args: [] },
      { method: 'next', args: [allContent] },
      { method: 'closeNode', args: [] },
    ]);
  });

  it('serializes uploaded callout icons as a callout metadata marker', () => {
    const { calls, state } = createRecorder();
    const firstParagraphContent = { id: 'first-paragraph-content', size: 1 };
    const firstParagraph = {
      type: { name: 'paragraph' },
      attrs: {},
      content: firstParagraphContent,
    };

    serializeCalloutToMarkdown(state, {
      attrs: {
        icon: { type: 'image', value: 'img:icons/demo.png' },
        backgroundColor: 'yellow',
      },
      firstChild: firstParagraph,
      childCount: 1,
      child: () => firstParagraph,
      content: null,
    });

    expect(calls).toEqual([
      { method: 'openNode', args: ['blockquote'] },
      { method: 'openNode', args: ['paragraph'] },
      { method: 'addNode', args: ['text', undefined, '[!callout-icon:img%3Aicons%2Fdemo.png] '] },
      { method: 'next', args: [firstParagraphContent] },
      { method: 'closeNode', args: [] },
      { method: 'closeNode', args: [] },
    ]);
  });
});

describe('callout editor behavior', () => {
  it('parses an empty serialized callout back into a callout with an empty paragraph', async () => {
    const editor = createEditor('> 💡');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('callout');
    expect(view.state.doc.firstChild?.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.firstChild?.content.size).toBe(0);
    expect(serializer(view.state.doc).trim()).toBe('> 💡');

    await editor.destroy();
  });

  it('keeps uploaded callout icons through markdown reopen', async () => {
    const editor = createEditor('> [!callout-icon:img%3Aicons%2Fdemo.png] Body');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('callout');
    expect(view.state.doc.firstChild?.attrs.icon).toEqual({
      type: 'image',
      value: 'img:icons/demo.png',
    });
    expect(serializer(view.state.doc).trim()).toBe('> [!callout-icon:img%3Aicons%2Fdemo.png] Body');

    await editor.destroy();
  });

  it('removes a leading uploaded icon marker even when markdown parsing preserves whitespace', async () => {
    const editor = createEditor('>   [!callout-icon:img%3Aicons%2Fdemo.png] Body');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('callout');
    expect(view.state.doc.firstChild?.attrs.icon).toEqual({
      type: 'image',
      value: 'img:icons/demo.png',
    });
    expect(view.state.doc.firstChild?.textContent).toBe('Body');

    await editor.destroy();
  });

  it('turns an empty callout into a normal paragraph on exit', async () => {
    const editor = createEditor('');
    await editor.create();

    const view: EditorView = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const callout = schema.nodes.callout.create(null, [
      schema.nodes.paragraph.create(),
    ]);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, callout));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));

    expect(handleEmptyCalloutExit(view)).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.selection.from).toBe(1);

    await editor.destroy();
  });

  it('moves the cursor out of a callout on Ctrl+Enter from the middle', async () => {
    const editor = createEditor('');
    await editor.create();

    const view: EditorView = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const callout = schema.nodes.callout.create(null, [
      schema.nodes.paragraph.create(null, schema.text('inside')),
      schema.nodes.paragraph.create(null, schema.text('more')),
    ]);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, callout));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 4)));

    const originalCalloutSize = view.state.doc.firstChild?.nodeSize ?? 0;

    expect(handleCalloutModEnterExit(view)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('callout');
    expect(view.state.doc.child(0).textContent).toBe('insidemore');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection.from).toBe(originalCalloutSize + 1);

    await editor.destroy();
  });
});
