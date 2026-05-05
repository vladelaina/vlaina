import { describe, expect, it } from 'vitest';
import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/kit/core';
import { AllSelection, NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { textSelectionOverlayPlugin } from './textSelectionOverlayPlugin';

const OVERLAY_ACTIVE_CLASS = 'vlaina-text-selection-overlay-active';

async function createEditor(defaultValue: string): Promise<EditorView> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(textSelectionOverlayPlugin)
    .create();

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

  it('does not hide native selection styling for node selections', async () => {
    const view = await createEditor('hello\n\n---\n\nworld');
    const hrPos = findNodePos(view, 'hr');

    expect(hrPos).toBeGreaterThanOrEqual(0);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(false);
  });
});
