import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeSerializedMarkdownDocument, stripTrailingNewlines } from '@/lib/notes/markdown/markdownSerializationUtils';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { configureTheme } from '../../theme';
import { colorMarksPlugin } from './colorMarks';
import { blockAlignmentPlugin } from './blockAlignmentMarkdown';
import { highlightPlugin } from '../highlight';
import {
  convertBlockType,
  setBgColor,
  setLink,
  setTextAlignment,
  setTextColor,
  toggleBold,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleStrikethrough,
  toggleUnderline,
} from './commands';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  for (const plugin of [...colorMarksPlugin, ...blockAlignmentPlugin, ...highlightPlugin]) {
    editor.use(plugin);
  }

  await editor.create();
  return editor;
}

type TestEditor = Awaited<ReturnType<typeof createEditor>>;
type HandleTextInput = (view: EditorView, from: number, to: number, text: string) => boolean;

function selectText(editor: TestEditor, text: string) {
  const view = editor.ctx.get(editorViewCtx);
  const start = view.state.doc.textBetween(0, view.state.doc.content.size).indexOf(text);
  expect(start).toBeGreaterThanOrEqual(0);
  const from = start + 1;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, from + text.length)));
  return view;
}

function selectBlockStart(editor: TestEditor) {
  const view = editor.ctx.get(editorViewCtx);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
  return view;
}

function typeText(view: EditorView, input: string) {
  for (const text of input) {
    const { from, to } = view.state.selection;
    let handled = false;

    view.someProp('handleTextInput', (handleTextInput: HandleTextInput) => {
      handled = handleTextInput(view, from, to, text) || handled;
    });

    if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
  }
}

async function persist(editor: TestEditor) {
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const persisted = stripTrailingNewlines(normalizeSerializedMarkdownDocument(serializer(view.state.doc)));
  await editor.destroy();
  return persisted;
}

describe('floating toolbar command markdown persistence', () => {
  it.each([
    ['bold', toggleBold, '**text**'],
    ['italic', toggleItalic, '*text*'],
    ['strikethrough', toggleStrikethrough, '~~text~~'],
    ['inline code', toggleCode, '`text`'],
    ['highlight', toggleHighlight, '==text=='],
    ['underline', toggleUnderline, '++text++'],
  ] as const)('persists %s selection formatting', async (_name, command, expected) => {
    const editor = await createEditor('text');
    command(selectText(editor, 'text'));
    await expect(persist(editor)).resolves.toBe(expected);
  });

  it('persists links as standard markdown links and rejects unsafe hrefs', async () => {
    const linked = await createEditor('link text');
    setLink(selectText(linked, 'link'), 'https://example.com/path?q=1');
    await expect(persist(linked)).resolves.toBe('[link](https://example.com/path?q=1) text');

    const unsafe = await createEditor('link text');
    setLink(selectText(unsafe, 'link'), 'javascript:alert(1)');
    await expect(persist(unsafe)).resolves.toBe('link text');
  });

  it('persists color commands as sanitized inline html', async () => {
    const textColor = await createEditor('color text');
    setTextColor(selectText(textColor, 'color'), '#123456');
    await expect(persist(textColor)).resolves.toBe('<span style="color: #123456">color</span> text');

    const bgColor = await createEditor('color text');
    setBgColor(selectText(bgColor, 'color'), '#ecf6ff');
    await expect(persist(bgColor)).resolves.toBe('<mark style="background-color: #ecf6ff">color</mark> text');
  });

  it.each([
    ['heading2', '## text'],
    ['blockquote', '> text'],
    ['bulletList', '- text'],
    ['orderedList', '1. text'],
    ['taskList', '- [ ] text'],
    ['codeBlock', ['```', 'text', '```'].join('\n')],
  ] as const)('persists block conversion %s', async (blockType, expected) => {
    const editor = await createEditor('text');
    const view = blockType === 'codeBlock' ? selectText(editor, 'text') : selectBlockStart(editor);
    convertBlockType(view, blockType);
    await expect(persist(editor)).resolves.toBe(expected);
  });

  it('persists non-left alignment as markdown html comments', async () => {
    const editor = await createEditor('text');
    setTextAlignment(selectBlockStart(editor), 'center');
    await expect(persist(editor)).resolves.toBe(['text', '', '<!--align:center-->'].join('\n'));
  });

  it.each([
    ['==highlight==x', 'highlight'],
    ['++underlined++x', 'underline'],
    ['X^2^x', 'superscript'],
    ['H~2~Ox', 'subscript'],
  ] as const)('does not keep %s active after input rule completion', async (input, markName) => {
    const editor = await createEditor('');
    const view = editor.ctx.get(editorViewCtx);

    typeText(view, input);

    const activeMarks = new Set<string>();
    view.state.doc.descendants((node) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => activeMarks.add(mark.type.name));
    });

    expect(activeMarks.has(markName)).toBe(true);
    await editor.destroy();
  });
});
