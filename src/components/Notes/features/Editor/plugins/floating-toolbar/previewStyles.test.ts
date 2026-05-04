import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { configureTheme } from '../../theme';
import { colorMarksPlugin } from './colorMarks';
import {
  applyAlignmentPreview,
  applyBgColorPreview,
  applyBlockPreview,
  applyFormatPreview,
  applyTextColorPreview,
  clearFormatPreview,
  commitBlockPreview,
  commitFormatPreview,
  hasBlockPreview,
  hasFormatPreview,
} from './previewStyles';
import { EXTRA_BUTTONS, FORMAT_BUTTONS } from './toolbarConfig';
import { BLOCK_TYPES } from './utils';

function findTextRange(doc: any, text: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved || !node.isText || typeof node.text !== 'string') return;
    const offset = node.text.indexOf(text);
    if (offset < 0) return;
    resolved = { from: pos + offset, to: pos + offset + text.length };
  });

  if (!resolved) {
    throw new Error(`Unable to find text: ${text}`);
  }

  return resolved;
}

async function createEditor(markdown: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = Editor.make()
    .config((ctx) => {
      configureTheme(ctx);
      ctx.set(rootCtx, host);
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm);

  colorMarksPlugin.forEach((plugin) => {
    editor.use(plugin);
  });

  await editor.create();
  return { editor, host, view: editor.ctx.get(editorViewCtx) };
}

function selectText(view: any, text: string) {
  const range = findTextRange(view.state.doc, text);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));
}

function normalizePreviewComparisonHtml(element: Element | null | undefined): string {
  if (!element) {
    return '';
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.ProseMirror-trailingBreak').forEach((node) => node.remove());
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('aria-hidden');
  clone.removeAttribute('data-toolbar-preview-hidden');
  clone.classList.remove(
    'toolbar-applied-preview-overlay',
    'ProseMirror-focused',
    'ProseMirror-hideselection'
  );
  clone.querySelectorAll('[contenteditable], [aria-hidden], [data-toolbar-preview-hidden]').forEach((node) => {
    node.removeAttribute('contenteditable');
    node.removeAttribute('aria-hidden');
    node.removeAttribute('data-toolbar-preview-hidden');
  });

  return clone.innerHTML
    .replace(/\sdata-allow-mismatch="[^"]*"/g, '')
    .replace(/\sdata-node-view-root="[^"]*"/g, '')
    .replace(/\sdata-node-view-content="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('previewStyles', () => {
  it('covers every toolbar format button and block dropdown item with the applied preview path', () => {
    expect(FORMAT_BUTTONS.map((button) => button.action).filter((action) => !hasFormatPreview(action))).toEqual([]);
    expect(hasFormatPreview('link')).toBe(true);
    expect(BLOCK_TYPES.map((item) => item.type).filter((blockType) => !hasBlockPreview(blockType))).toEqual([]);
  });

  it('keeps every toolbar content-effect entry tied to the applied preview surface', () => {
    const formatEffects = FORMAT_BUTTONS.map((button) => button.action);
    const submenuEffects = ['block', 'alignment', 'color'];
    const extraEffects = EXTRA_BUTTONS
      .map((button) => button.action)
      .filter((action) => action === 'link' || action === 'color');

    expect(formatEffects.filter((action) => !hasFormatPreview(action))).toEqual([]);
    expect(extraEffects.filter((action) => action === 'link' && !hasFormatPreview(action))).toEqual([]);
    expect(submenuEffects).toEqual(['block', 'alignment', 'color']);
    expect(BLOCK_TYPES.every((item) => hasBlockPreview(item.type))).toBe(true);
  });

  it('renders block previews from an applied shadow document without mutating the editor state', async () => {
    const { editor, host, view } = await createEditor(['> before', '>', '> selected', '>', '> after'].join('\n'));
    const originalDoc = view.state.doc;
    selectText(view, 'selected');

    applyBlockPreview(view, 'taskList');

    const overlay = host.querySelector('.toolbar-applied-preview-overlay');
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect(view.dom.style.display).toBe('none');
    expect(overlay?.getAttribute('contenteditable')).toBe(view.dom.getAttribute('contenteditable'));
    expect(view.state.doc).toBe(originalDoc);
    expect((overlay as HTMLElement | null)?.style.position).toBe('');
    expect(overlay?.nextElementSibling).toBe(view.dom);
    expect(overlay?.querySelector('ul')).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelectorAll('blockquote').length).toBeGreaterThanOrEqual(1);

    clearFormatPreview(view);

    expect(host.querySelector('.toolbar-applied-preview-overlay')).toBeNull();
    expect(view.dom.style.display).toBe('');
    expect(view.state.doc).toBe(originalDoc);

    await editor.destroy();
    host.remove();
  });

  it('renders the applied preview in flow instead of as a geometry overlay', async () => {
    const { editor, host, view } = await createEditor(['intro', '', 'target'].join('\n'));
    view.dom.setAttribute('translate', 'no');
    view.dom.setAttribute('spellcheck', 'false');
    view.dom.style.whiteSpace = 'pre-wrap';
    view.dom.style.lineHeight = '31px';
    view.dom.style.fontSize = '17px';
    selectText(view, 'target');

    applyFormatPreview(view, 'bold');

    const overlay = host.querySelector<HTMLElement>('.toolbar-applied-preview-overlay');
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect(overlay?.getAttribute('contenteditable')).toBe(view.dom.getAttribute('contenteditable'));
    expect(overlay?.getAttribute('translate')).toBe('no');
    expect(overlay?.getAttribute('spellcheck')).toBe('false');
    expect(overlay?.style.whiteSpace).toBe('pre-wrap');
    expect(overlay?.style.lineHeight).toBe('31px');
    expect(overlay?.style.fontSize).toBe('17px');
    expect(overlay?.style.position).toBe('');
    expect(overlay?.style.minHeight).toBe('');
    expect(overlay?.nextElementSibling).toBe(view.dom);
    expect(view.dom.style.display).toBe('none');

    clearFormatPreview(view);
    expect(view.dom.style.display).toBe('');
    await editor.destroy();
    host.remove();
  });

  it('restores an existing inline editor display value after clearing the flow preview', async () => {
    const { editor, host, view } = await createEditor('position me');
    view.dom.style.display = 'block';
    selectText(view, 'position');

    applyFormatPreview(view, 'bold');

    expect(view.dom.style.display).toBe('none');

    clearFormatPreview(view);
    expect(view.dom.style.display).toBe('block');
    await editor.destroy();
    host.remove();
  });

  it('previews a multi-paragraph code block selection as the real applied document', async () => {
    const { editor, host, view } = await createEditor(['first paragraph', '', 'second paragraph'].join('\n'));
    const originalDoc = view.state.doc;
    const from = findTextRange(view.state.doc, 'first paragraph').from;
    const to = findTextRange(view.state.doc, 'second paragraph').to;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));

    applyBlockPreview(view, 'codeBlock');

    const overlay = host.querySelector('.toolbar-applied-preview-overlay');
    const codeBlock = overlay?.querySelector('pre, .code-block-container');
    expect(codeBlock).toBeInstanceOf(HTMLElement);
    expect(codeBlock?.textContent).toContain('first paragraph');
    expect(codeBlock?.textContent).toContain('second paragraph');
    expect(overlay?.querySelectorAll('pre, .code-block-container')).toHaveLength(1);
    expect(view.state.doc).toBe(originalDoc);

    clearFormatPreview(view);
    await editor.destroy();
    host.remove();
  });

  it('renders inline mark previews by applying the real mark command to a shadow document', async () => {
    const { editor, host, view } = await createEditor('format me');
    const originalDoc = view.state.doc;
    selectText(view, 'format');

    applyFormatPreview(view, 'bold');

    const overlay = host.querySelector('.toolbar-applied-preview-overlay');
    expect(overlay?.querySelector('strong')?.textContent).toBe('format');
    expect(view.state.doc).toBe(originalDoc);

    clearFormatPreview(view);
    await editor.destroy();
    host.remove();
  });

  it('commits an active applied preview with one final document update', async () => {
    const { editor, host, view } = await createEditor('format me');
    selectText(view, 'format');

    applyFormatPreview(view, 'bold');

    expect(view.state.doc.rangeHasMark(
      findTextRange(view.state.doc, 'format').from,
      findTextRange(view.state.doc, 'format').to,
      view.state.schema.marks.strong
    )).toBe(false);

    expect(commitFormatPreview(view, 'bold', false)).toBe(true);

    const range = findTextRange(view.state.doc, 'format');
    expect(view.state.doc.rangeHasMark(range.from, range.to, view.state.schema.marks.strong)).toBe(true);
    expect(host.querySelector('.toolbar-applied-preview-overlay')).toBeInstanceOf(HTMLElement);

    clearFormatPreview(view);

    expect(host.querySelector('.toolbar-applied-preview-overlay')).toBeNull();
    expect(view.dom.style.display).toBe('');

    await editor.destroy();
    host.remove();
  });

  it('keeps block preview markup equivalent to the committed editor markup', async () => {
    const cases: Array<{ markdown: string; selected: string; blockType: typeof BLOCK_TYPES[number]['type'] }> = [
      { markdown: 'plain target', selected: 'target', blockType: 'heading1' },
      { markdown: 'plain target', selected: 'target', blockType: 'blockquote' },
      { markdown: 'plain target', selected: 'target', blockType: 'bulletList' },
      { markdown: 'plain target', selected: 'target', blockType: 'orderedList' },
      { markdown: 'plain target', selected: 'target', blockType: 'taskList' },
    ];

    for (const testCase of cases) {
      const { editor, host, view } = await createEditor(testCase.markdown);
      selectText(view, testCase.selected);

      applyBlockPreview(view, testCase.blockType);

      const overlay = host.querySelector('.toolbar-applied-preview-overlay');
      const previewHtml = normalizePreviewComparisonHtml(overlay);

      expect(commitBlockPreview(view, testCase.blockType)).toBe(true);
      clearFormatPreview(view);

      expect(normalizePreviewComparisonHtml(view.dom)).toBe(previewHtml);

      await editor.destroy();
      host.remove();
    }
  });

  it('builds replacement previews from the restored editor instead of the hidden previous preview state', async () => {
    const { editor, host, view } = await createEditor('target text');
    view.dom.style.lineHeight = '33px';
    selectText(view, 'target');

    applyFormatPreview(view, 'bold');
    expect(view.dom.style.display).toBe('none');

    applyFormatPreview(view, 'italic');

    const overlay = host.querySelector<HTMLElement>('.toolbar-applied-preview-overlay');
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect(overlay?.style.display).toBe('');
    expect(overlay?.style.lineHeight).toBe('33px');
    expect(view.dom.style.display).toBe('none');

    clearFormatPreview(view);
    await editor.destroy();
    host.remove();
  });

  it('renders active link previews by applying the real unlink command to a shadow document', async () => {
    const { editor, host, view } = await createEditor('[linked text](https://example.com)');
    const originalDoc = view.state.doc;
    selectText(view, 'linked text');

    applyFormatPreview(view, 'link', true);

    const overlay = host.querySelector('.toolbar-applied-preview-overlay');
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector('a')).toBeNull();
    expect(overlay?.textContent).toContain('linked text');
    expect(view.state.doc).toBe(originalDoc);

    clearFormatPreview(view);
    await editor.destroy();
    host.remove();
  });

  it('does not render an inactive link preview because adding a link requires user input', async () => {
    const { editor, host, view } = await createEditor('plain text');
    const originalDoc = view.state.doc;
    selectText(view, 'plain text');

    applyFormatPreview(view, 'link', false);

    expect(host.querySelector('.toolbar-applied-preview-overlay')).toBeNull();
    expect(view.state.doc).toBe(originalDoc);

    await editor.destroy();
    host.remove();
  });

  it('renders color and background previews from the same command path used by apply', async () => {
    const { editor, host, view } = await createEditor('color me');
    const originalDoc = view.state.doc;
    selectText(view, 'color');

    applyTextColorPreview(view, '#ef4444');
    let overlay = host.querySelector('.toolbar-applied-preview-overlay');
    expect(overlay?.querySelector('[style*="#ef4444"], [style*="239, 68, 68"]')).toBeInstanceOf(HTMLElement);
    expect(view.state.doc).toBe(originalDoc);

    applyBgColorPreview(view, '#fde68a');
    overlay = host.querySelector('.toolbar-applied-preview-overlay');
    expect(overlay?.querySelector('[style*="#fde68a"], [style*="253, 230, 138"]')).toBeInstanceOf(HTMLElement);
    expect(view.state.doc).toBe(originalDoc);

    clearFormatPreview(view);
    await editor.destroy();
    host.remove();
  });

  it('renders alignment previews by applying the real alignment command to a shadow document', async () => {
    const { editor, host, view } = await createEditor('align me');
    const originalDoc = view.state.doc;
    selectText(view, 'align');

    applyAlignmentPreview(view, 'center');

    const overlay = host.querySelector('.toolbar-applied-preview-overlay');
    expect(overlay?.querySelector('[style*="text-align: center"], [align="center"]')).toBeInstanceOf(HTMLElement);
    expect(view.state.doc).toBe(originalDoc);

    clearFormatPreview(view);
    await editor.destroy();
    host.remove();
  });
});
