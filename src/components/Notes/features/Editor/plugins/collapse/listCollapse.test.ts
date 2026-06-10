import { afterEach, describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import {
  MAX_LIST_COLLAPSE_CHILD_SCAN_NODES,
  buildListCollapsePluginState,
  canMapListCollapsePluginState,
  findNestedListCollapseRange,
  listCollapsePlugin,
} from './listCollapse';

async function createEditor(markdown: string, options: { gfm?: boolean } = {}) {
  let editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark);

  if (options.gfm) {
    editor = editor.use(gfm);
  }

  editor = editor.use(listCollapsePlugin);

  await editor.create();
  return editor;
}

function dispatchTogglePointer(button: HTMLElement) {
  if (typeof PointerEvent !== 'undefined') {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    return;
  }

  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('listCollapsePlugin', () => {
  it('bounds nested list child scans inside a single list item', () => {
    let accessed = 0;
    const children = [
      ...Array.from({ length: MAX_LIST_COLLAPSE_CHILD_SCAN_NODES }, () => ({
        nodeSize: 2,
        type: { name: 'paragraph' },
      })),
      {
        nodeSize: 4,
        type: { name: 'bullet_list' },
      },
    ];
    const listItem = {
      childCount: children.length,
      child(index: number) {
        accessed += 1;
        return children[index];
      },
    };

    expect(findNestedListCollapseRange(listItem, 10)).toBeNull();
    expect(accessed).toBe(MAX_LIST_COLLAPSE_CHILD_SCAN_NODES);
  });

  it('does not create hidden toggles for flat list items', async () => {
    const editor = await createEditor('- One\n- Two\n- Three');
    const view = editor.ctx.get(editorViewCtx);

    expect(view.dom.querySelectorAll('.editor-collapse-btn')).toHaveLength(0);

    await editor.destroy();
  });

  it('collapses nested list content from a list item toggle', async () => {
    const editor = await createEditor('- Parent\n  - Child');
    const view = editor.ctx.get(editorViewCtx);
    const toggle = view.dom.querySelector<HTMLElement>('.editor-collapse-btn[data-has-content="true"]');

    expect(toggle).not.toBeNull();
    dispatchTogglePointer(toggle!);

    expect(view.dom.querySelector('.editor-collapsed-content')).not.toBeNull();

    await editor.destroy();
  });

  it('collapses nested task list content through the list item path', async () => {
    const editor = await createEditor('- [ ] Parent\n  - [ ] Child', { gfm: true });
    const view = editor.ctx.get(editorViewCtx);
    const taskItem = view.dom.querySelector('li[data-item-type="task"]');
    const toggle = view.dom.querySelector<HTMLElement>('.editor-collapse-btn[data-has-content="true"]');

    expect(taskItem).not.toBeNull();
    expect(toggle).not.toBeNull();
    dispatchTogglePointer(toggle!);

    expect(view.dom.querySelector('.editor-collapsed-content')).not.toBeNull();

    await editor.destroy();
  });

  it('moves ordered list toggles left enough for wide item markers', async () => {
    const editor = await createEditor('111. Parent\n     1. Child');
    const view = editor.ctx.get(editorViewCtx);
    const toggle = view.dom.querySelector<HTMLElement>('.editor-collapse-btn[data-has-content="true"]');

    expect(toggle).not.toBeNull();
    expect(toggle!.style.getPropertyValue('--vlaina-list-marker-extra')).toBe('2ch');

    await editor.destroy();
  });

  it('caps generated list collapse toggles in large nested lists', async () => {
    const markdown = Array.from(
      { length: 1005 },
      (_, index) => `- Parent ${index}\n  - Child ${index}`,
    ).join('\n');
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);

    expect(view.dom.querySelectorAll('.editor-collapse-btn[data-has-content="true"]')).toHaveLength(1000);

    await editor.destroy();
  });

  it('keeps collapsed list items mapped after document edits above them', async () => {
    const editor = await createEditor('- Parent\n  - Child');
    const view = editor.ctx.get(editorViewCtx);
    const toggle = view.dom.querySelector<HTMLElement>('.editor-collapse-btn[data-has-content="true"]');

    expect(toggle).not.toBeNull();
    dispatchTogglePointer(toggle!);

    const paragraph = view.state.schema.nodes.paragraph.create(
      null,
      view.state.schema.text('Intro'),
    );
    view.dispatch(view.state.tr.insert(0, paragraph));

    expect(view.dom.querySelector('.editor-collapsed-content')).not.toBeNull();

    await editor.destroy();
  });

  it('maps list collapse decorations for ordinary paragraph input after existing nested lists', async () => {
    const editor = await createEditor('- Parent\n  - Child\n\nTail');
    const view = editor.ctx.get(editorViewCtx);
    const pluginState = buildListCollapsePluginState(view.state.doc, new Set(), () => undefined);
    const tr = view.state.tr.insertText(' typed', view.state.doc.content.size - 1);

    expect(canMapListCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(true);

    await editor.destroy();
  });

  it('rescans list collapse decorations when edits can move existing list toggle positions', async () => {
    const editor = await createEditor('- Parent\n  - Child\n\nTail');
    const view = editor.ctx.get(editorViewCtx);
    const pluginState = buildListCollapsePluginState(view.state.doc, new Set(), () => undefined);
    const tr = view.state.tr.insertText('Intro\n\n', 0);

    expect(canMapListCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(false);

    await editor.destroy();
  });

  it('rescans list collapse decorations for edits inside list structure', async () => {
    const editor = await createEditor('- Parent\n  - Child\n\nTail');
    const view = editor.ctx.get(editorViewCtx);
    const pluginState = buildListCollapsePluginState(view.state.doc, new Set(), () => undefined);
    const tr = view.state.tr.insertText(' typed', 4);

    expect(canMapListCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(false);

    await editor.destroy();
  });

  it('rescans list collapse decorations while any item is collapsed', async () => {
    const editor = await createEditor('- Parent\n  - Child\n\nTail');
    const view = editor.ctx.get(editorViewCtx);
    const pluginState = buildListCollapsePluginState(view.state.doc, new Set([1]), () => undefined);
    const tr = view.state.tr.insertText(' typed', view.state.doc.content.size - 1);

    expect(canMapListCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(false);

    await editor.destroy();
  });
});
