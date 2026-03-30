import '@testing-library/jest-dom/vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/core';
import { Selection as ProseSelection } from '../../../../../../../vendor/milkdown/packages/prose/src/state';
import { commonmark } from '../../../../../../../vendor/milkdown/packages/plugins/preset-commonmark/src/index';
import { gfm } from '../../../../../../../vendor/milkdown/packages/plugins/preset-gfm/src/index';
import { getMarkdown } from '../../../../../../../vendor/milkdown/packages/utils/src/index';
import type { EditorView } from '@milkdown/kit/prose/view';
import { expect, it } from 'vitest';

function createEditorWithContent(content: string) {
  const editor = Editor.make() as any;
  editor
    .config((ctx: any) => {
      ctx.set(defaultValueCtx, content);
      ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
        ...prev,
        bullet: '-',
      }));
    })
    .use(commonmark)
    .use(gfm);
  return editor;
}

function moveCursorToDocumentEnd(view: EditorView) {
  const selection = (ProseSelection as any).atEnd((view.state as any).doc);
  view.dispatch((view.state as any).tr.setSelection(selection));
}

function pressEnter(view: EditorView) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  expect(handled).toBe(true);
}

it('keeps task list semantics when splitting a non-empty task item', async () => {
  const editor = createEditorWithContent('- [ ] item');

  await editor.create();

  const view = editor.ctx.get(editorViewCtx);
  moveCursorToDocumentEnd(view);
  pressEnter(view);

  const markdown = editor.action(getMarkdown());
  expect(markdown).toContain('- [ ] item');
  expect(markdown).toContain('- [ ] <br />');
  expect(markdown).not.toContain('\n- <br />');
});

it('creates a new unchecked task item when splitting a checked task item', async () => {
  const editor = createEditorWithContent('- [x] item');

  await editor.create();

  const view = editor.ctx.get(editorViewCtx);
  moveCursorToDocumentEnd(view);
  pressEnter(view);

  const markdown = editor.action(getMarkdown());
  expect(markdown).toContain('- [x] item');
  expect(markdown).toContain('- [ ] <br />');
  expect(markdown).not.toContain('- [x] <br />');
  expect(markdown).not.toContain('\n- <br />');
});

it('keeps task list semantics when exiting an empty nested task item', async () => {
  const editor = createEditorWithContent('- [ ] 1\n  - [ ] 2\n    - [ ] 3');

  await editor.create();

  const view = editor.ctx.get(editorViewCtx);
  moveCursorToDocumentEnd(view);
  pressEnter(view);
  pressEnter(view);

  const markdown = editor.action(getMarkdown());
  expect(markdown).toContain('- [ ] 1');
  expect(markdown).toContain('  - [ ] 2');
  expect(markdown).toContain('    - [ ] 3');
  expect(markdown).toContain('  - [ ] <br />');
  expect(markdown).not.toContain('  - <br />');
});

it('keeps nested exits in task-list mode after splitting a checked task item', async () => {
  const editor = createEditorWithContent('- [ ] 1\n  - [x] 2');

  await editor.create();

  const view = editor.ctx.get(editorViewCtx);
  moveCursorToDocumentEnd(view);
  pressEnter(view);
  pressEnter(view);

  const markdown = editor.action(getMarkdown());
  expect(markdown).toContain('- [ ] 1');
  expect(markdown).toContain('  - [x] 2');
  expect(markdown).toContain('- [ ] <br />');
  expect(markdown).not.toContain('\n- <br />');
});
