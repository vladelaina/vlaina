import { describe, expect, it, vi } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { DOMParser as ProseDOMParser } from '@milkdown/kit/prose/model';
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

async function parseCalloutAttrsFromDom(setup: (callout: HTMLElement) => void) {
  const editor = createEditor('');
  await editor.create();

  const callout = document.createElement('div');
  callout.dataset.type = 'callout';
  setup(callout);

  const paragraph = document.createElement('p');
  paragraph.textContent = 'Body';
  callout.append(paragraph);

  const container = document.createElement('div');
  container.append(callout);

  const schema = editor.ctx.get(editorViewCtx).state.schema;
  const doc = ProseDOMParser.fromSchema(schema).parse(container);
  let attrs: Record<string, unknown> | null = null;
  doc.descendants((node) => {
    if (node.type.name === 'callout') {
      attrs = node.attrs;
      return false;
    }
    return true;
  });

  await editor.destroy();
  return attrs;
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

  it('keeps uploaded callout icons with a case-insensitive image scheme through markdown reopen', async () => {
    const editor = createEditor('> [!callout-icon:IMG%3Aicons%2Fdemo.png] Body');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('callout');
    expect(view.state.doc.firstChild?.attrs.icon).toEqual({
      type: 'image',
      value: 'IMG:icons/demo.png',
    });
    expect(serializer(view.state.doc).trim()).toBe('> [!callout-icon:IMG%3Aicons%2Fdemo.png] Body');

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

  it('keeps oversized uploaded icon markers as ordinary blockquotes', async () => {
    const editor = createEditor(`> [!callout-icon:${'a'.repeat(4097)}] Body`);
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('blockquote');
    expect(view.state.doc.firstChild?.textContent).toContain('[!callout-icon:');
    expect(view.state.doc.firstChild?.textContent).toContain('Body');

    await editor.destroy();
  });

  it('normalizes callout attrs parsed from DOM', async () => {
    const oversizedIconPayload = JSON.stringify({ type: 'image', value: 'img:icons/demo.png' }) + 'x'.repeat(4096);

    await expect(parseCalloutAttrsFromDom((callout) => {
      callout.dataset.icon = oversizedIconPayload;
      callout.dataset.bg = 'red invalid';
    })).resolves.toMatchObject({
      icon: { type: 'emoji', value: '💡' },
      backgroundColor: 'yellow',
    });

    await expect(parseCalloutAttrsFromDom((callout) => {
      callout.dataset.icon = JSON.stringify({ type: 'image', value: 'plain text' });
      callout.dataset.bg = 'green';
    })).resolves.toMatchObject({
      icon: { type: 'emoji', value: 'plain text' },
      backgroundColor: 'green',
    });
  });

  it('keeps ordinary numbered blockquotes as blockquotes instead of callouts', async () => {
    const editor = createEditor('> 1. Keep this as a quoted list item');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('blockquote');
    expect(view.state.doc.firstChild?.type.name).not.toBe('callout');
    expect(serializer(view.state.doc).trim()).toBe('> 1. Keep this as a quoted list item');

    await editor.destroy();
  });

  it('keeps ascii-leading blockquotes as blockquotes instead of callouts', async () => {
    const editor = createEditor('> Note: keep this as a quote');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    expect(view.state.doc.firstChild?.type.name).toBe('blockquote');
    expect(view.state.doc.firstChild?.type.name).not.toBe('callout');
    expect(serializer(view.state.doc).trim()).toBe('> Note: keep this as a quote');

    await editor.destroy();
  });

  it('keeps text-presentation symbol blockquotes as blockquotes instead of callouts', async () => {
    const editor = createEditor('> © Copyright\n\n> ™ Trademark');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    expect(view.state.doc.child(0).type.name).toBe('blockquote');
    expect(view.state.doc.child(1).type.name).toBe('blockquote');
    expect(view.state.doc.child(0).type.name).not.toBe('callout');
    expect(view.state.doc.child(1).type.name).not.toBe('callout');
    expect(serializer(view.state.doc).trim()).toBe('> © Copyright\n\n> ™ Trademark');

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
    const userInputListener = vi.fn();
    view.dom.addEventListener('editor:block-user-input', userInputListener);

    expect(handleEmptyCalloutExit(view)).toBe(true);
    expect(userInputListener).toHaveBeenCalledTimes(1);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.selection.from).toBe(1);

    view.dom.removeEventListener('editor:block-user-input', userInputListener);
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
    const userInputListener = vi.fn();
    view.dom.addEventListener('editor:block-user-input', userInputListener);

    expect(handleCalloutModEnterExit(view)).toBe(true);
    expect(userInputListener).toHaveBeenCalledTimes(1);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('callout');
    expect(view.state.doc.child(0).textContent).toBe('insidemore');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection.from).toBe(originalCalloutSize + 1);

    view.dom.removeEventListener('editor:block-user-input', userInputListener);
    await editor.destroy();
  });
});
