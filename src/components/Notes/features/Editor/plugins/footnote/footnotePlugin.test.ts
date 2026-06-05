import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { DOMParser as ProseDOMParser } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import {
  footnotePlugin,
  handleFootnoteArrowNavigation,
  handleFootnoteModEnterExit,
  serializeFootnoteDefinitionToMarkdown,
} from './footnotePlugin';
import { normalizeFootnoteLabel, normalizeFootnotePreview } from './footnoteLabels';
import { configureTheme } from '../../theme';

function createRecorder() {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const state = {
    openNode: (...args: unknown[]) => {
      calls.push({ method: 'openNode', args });
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

describe('footnote markdown serialization', () => {
  it('serializes footnote definitions as real footnoteDefinition nodes', () => {
    const { calls, state } = createRecorder();
    const content = { id: 'footnote-content' };

    serializeFootnoteDefinitionToMarkdown(state, {
      attrs: { id: 'note-1' },
      content,
    });

    expect(calls).toEqual([
      {
        method: 'openNode',
        args: ['footnoteDefinition', undefined, { label: 'note-1', identifier: 'note-1' }],
      },
      { method: 'next', args: [content] },
      { method: 'closeNode', args: [] },
    ]);
  });

  it('normalizes footnote ids before markdown serialization', () => {
    const { calls, state } = createRecorder();
    const content = { id: 'footnote-content' };

    serializeFootnoteDefinitionToMarkdown(state, {
      attrs: { id: ` ${'a'.repeat(140)}\u202E ` },
      content,
    });

    expect(calls[0]).toEqual({
      method: 'openNode',
      args: ['footnoteDefinition', undefined, {
        label: 'a'.repeat(128),
        identifier: 'a'.repeat(128),
      }],
    });
  });
});

describe('footnote reference markup', () => {
  it('normalizes footnote labels and preview text', () => {
    expect(normalizeFootnoteLabel(` note[1]\u202E${'x'.repeat(140)} `)).toBe(`note1${'x'.repeat(123)}`);
    expect(normalizeFootnotePreview(` ${'x '.repeat(600)}`)).toBe('x '.repeat(256).trim());
  });

  it('uses a data-backed custom tooltip instead of the native title tooltip', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/footnote/footnotePlugin.ts'),
      'utf8'
    );

    expect(source).toContain("'data-footnote-value': label");
    expect(source).toContain("'aria-label': `Footnote ${id}`");
    expect(source).not.toContain('title: `Footnote ${id}`');
  });

  it('applies the custom footnote markup to the active GFM schema', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['Footnote ref[^1].', '', '[^1]: Footnote body'].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const reference = view.dom.querySelector('sup.footnote-ref');
    const definition = view.dom.querySelector('.footnote-def');

    expect(reference?.getAttribute('data-type')).toBe('footnote_reference');
    expect(reference?.getAttribute('data-footnote-value')).toBe('[1]');
    expect(reference?.getAttribute('contenteditable')).toBe('false');
    expect(reference?.querySelector('a')).toBeNull();
    expect(reference?.querySelector('.footnote-ref-label')?.textContent).toBe('[1]');
    expect(reference?.querySelector('.footnote-ref-label')?.getAttribute('contenteditable')).toBe('false');
    expect(reference?.getAttribute('title')).toBeNull();
    expect(definition?.getAttribute('data-type')).toBe('footnote_definition');
    expect(definition?.querySelector('.footnote-def-label')?.textContent).toBe('[1]:');
    expect(definition?.querySelector('.footnote-def-label')?.getAttribute('contenteditable')).toBe('false');

    await editor.destroy();
  });

  it('normalizes GFM footnote labels from markdown and DOM attrs', async () => {
    const longId = 'a'.repeat(140);
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [`Text[^${longId}].`, '', `[^${longId}]: Body`].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const reference = view.dom.querySelector('sup.footnote-ref');
    const definition = view.dom.querySelector('.footnote-def');

    expect(reference?.getAttribute('data-id')).toBe('a'.repeat(128));
    expect(definition?.getAttribute('data-id')).toBe('a'.repeat(128));

    const container = document.createElement('div');
    container.innerHTML = [
      `<p>Text<sup class="footnote-ref" data-id=" ${'b'.repeat(140)}\u202E "></sup></p>`,
      `<div class="footnote-def" data-id=" ${'b'.repeat(140)}\u202E "><div class="footnote-def-content"><p>Body</p></div></div>`,
    ].join('');
    const parsed = ProseDOMParser.fromSchema(view.state.schema).parse(container);
    const attrs: Record<string, unknown>[] = [];
    parsed.descendants((node) => {
      if (node.type.name === 'footnote_reference' || node.type.name === 'footnote_definition') {
        attrs.push(node.attrs);
      }
      return true;
    });

    expect(attrs).toEqual([
      { label: 'b'.repeat(128) },
      { label: 'b'.repeat(128) },
    ]);

    await editor.destroy();
  });

  it('moves across GFM footnote references as a single inline unit with arrow keys', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['A[^1]B', '', '[^1]: Footnote body'].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme)
      .use(footnotePlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    let footnoteFrom: number | null = null;

    view.state.doc.child(0).descendants((node, pos) => {
      if (node.type.name === 'footnote_reference') {
        footnoteFrom = 1 + pos;
      }
    });

    expect(footnoteFrom).toBeTypeOf('number');

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, footnoteFrom!)));
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    expect(handleFootnoteArrowNavigation(view, rightEvent)).toBe(true);
    expect(rightEvent.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBe(footnoteFrom! + 1);

    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    expect(handleFootnoteArrowNavigation(view, leftEvent)).toBe(true);
    expect(leftEvent.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBe(footnoteFrom);

    await editor.destroy();
  });

  it('keeps GFM footnote references atomic for deletion operations', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['A[^1]B', '', '[^1]: Footnote body'].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const paragraph = view.state.doc.child(0);
    let footnoteFrom: number | null = null;
    let footnoteSize: number | null = null;

    paragraph.descendants((node, pos) => {
      if (node.type.name === 'footnote_reference') {
        footnoteFrom = 1 + pos;
        footnoteSize = node.nodeSize;
      }
    });

    expect(footnoteFrom).toBeTypeOf('number');
    expect(footnoteSize).toBe(1);

    const from = footnoteFrom!;
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, from, from + footnoteSize!))
        .deleteSelection()
    );

    expect(view.state.doc.child(0).textContent).toBe('AB');
    expect(view.dom.querySelector('sup.footnote-ref')).toBeNull();

    await editor.destroy();
  });

  it('scrolls to the matching definition when a footnote reference is clicked', async () => {
    const scrollIntoView = vi.fn();
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['A[^1]B', '', '[^1]: Footnote body'].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme)
      .use(footnotePlugin);

    try {
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      const referenceLabel = view.dom.querySelector('.footnote-ref-label');
      const definition = view.dom.querySelector('.footnote-def');

      expect(referenceLabel).toBeInstanceOf(HTMLElement);
      expect(definition).toBeInstanceOf(HTMLElement);

      referenceLabel?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
      expect(scrollIntoView.mock.contexts[0]).toBe(definition);
    } finally {
      await editor.destroy();
      HTMLElement.prototype.scrollIntoView = previousScrollIntoView;
    }
  });

  it('shows the footnote definition content in the hover capsule', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['Text[^note2].', '', '[^note2]: Footnote body with detail'].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme)
      .use(footnotePlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const reference = view.dom.querySelector('sup.footnote-ref');

    expect(reference?.getAttribute('data-footnote-value')).toBe('Footnote body with detail');

    await editor.destroy();
  });

  it('bounds long footnote hover preview text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['Text[^note].', '', `[^note]: ${'x'.repeat(600)}`].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme)
      .use(footnotePlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const reference = view.dom.querySelector('sup.footnote-ref');

    expect(reference?.getAttribute('data-footnote-value')).toBe('x'.repeat(512));

    await editor.destroy();
  });

  it('moves the cursor out of a footnote definition on Ctrl+Enter from its content', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['Text[^note2].', '', '[^note2]: Footnote body'].join('\n'));
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme)
      .use(footnotePlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    let footnoteTextPos: number | null = null;

    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Footnote body') {
        footnoteTextPos = pos + node.text.length;
        return false;
      }
      return;
    });

    expect(footnoteTextPos).toBeTypeOf('number');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, footnoteTextPos!)));

    const originalFootnoteSize = view.state.doc.child(1).nodeSize;
    const userInputListener = vi.fn();
    view.dom.addEventListener('editor:block-user-input', userInputListener);

    expect(handleFootnoteModEnterExit(view)).toBe(true);

    expect(userInputListener).toHaveBeenCalledTimes(1);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).type.name).toBe('footnote_definition');
    expect(view.state.doc.child(2).type.name).toBe('paragraph');
    expect(view.state.selection.from).toBe(view.state.doc.child(0).nodeSize + originalFootnoteSize + 1);

    view.dom.removeEventListener('editor:block-user-input', userInputListener);
    await editor.destroy();
  });
});
