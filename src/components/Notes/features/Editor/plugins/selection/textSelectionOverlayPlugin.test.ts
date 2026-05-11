import { describe, expect, it } from 'vitest';
import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/kit/core';
import { AllSelection, NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { textSelectionOverlayPlugin } from './textSelectionOverlayPlugin';
import { mathPlugin } from '../math';
import { tocPlugin } from '../toc';
import { videoPlugin } from '../video';

const OVERLAY_ACTIVE_CLASS = 'vlaina-text-selection-overlay-active';

async function createEditor(defaultValue: string, plugins: MilkdownPlugin[] = []): Promise<EditorView> {
  let editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(textSelectionOverlayPlugin);

  for (const plugin of plugins) {
    editor = editor.use(plugin);
  }

  await editor.create();

  return editor.ctx.get(editorViewCtx);
}

function findNodePos(view: EditorView, typeName: string): number {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === typeName) {
      found = pos;
      return false;
    }

    return true;
  });

  return found;
}

describe('textSelectionOverlayPlugin', () => {
  it('enables overlay styling for ordinary text selections', async () => {
    const view = await createEditor('hello');

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
  });

  it('keeps overlay styling for editor select-all selections', async () => {
    const view = await createEditor('hello\n\nworld');

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
  });

  it('adds block selection styling to formulas covered by editor select-all', async () => {
    const view = await createEditor('before\n\n$$\nx^2\n$$\n\nafter', mathPlugin);

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(
      view.dom.querySelector('[data-type="math-block"]')?.classList.contains('vlaina-block-selected')
    ).toBe(true);
    expect(
      view.dom.querySelector('[data-type="math-block"]')?.classList.contains('vlaina-atomic-selected')
    ).toBe(true);
  });

  it('adds block selection styling to tables covered by editor select-all', async () => {
    const view = await createEditor('| A | B |\n| --- | --- |\n| 1 | 2 |', [gfm]);

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.querySelector('table')?.classList.contains('vlaina-block-selected')).toBe(
      true
    );
    expect(view.dom.querySelector('table')?.classList.contains('vlaina-atomic-selected')).toBe(
      true
    );
  });

  it.each([
    {
      typeName: 'video',
      plugins: videoPlugin,
      attrs: { src: '', title: '', width: 560, height: 315 },
      selector: '[data-type="video"]',
    },
    {
      typeName: 'toc',
      plugins: tocPlugin,
      attrs: { maxLevel: 6 },
      selector: '[data-type="toc"]',
    },
  ])('adds block selection styling to $typeName blocks covered by editor select-all', async ({ typeName, plugins, attrs, selector }) => {
    const view = await createEditor('placeholder', plugins);
    const nodeType = view.state.schema.nodes[typeName];
    expect(nodeType).toBeDefined();

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodeType.create(attrs)));
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.querySelector(selector)?.classList.contains('vlaina-block-selected')).toBe(
      true
    );
    expect(view.dom.querySelector(selector)?.classList.contains('vlaina-atomic-selected')).toBe(
      true
    );
  });

  it('does not hide native selection styling for node selections', async () => {
    const view = await createEditor('hello\n\n---\n\nworld');
    const hrPos = findNodePos(view, 'hr');

    expect(hrPos).toBeGreaterThanOrEqual(0);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(false);
  });
});
