import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditorContextMenu } from './NoteEditorContextMenu';

const mocks = vi.hoisted(() => ({
  applySourceBlockType: vi.fn(),
  applySourceFormatting: vi.fn(),
  copySourceSelection: vi.fn(),
  cutSourceSelection: vi.fn(),
  deleteSourceSelection: vi.fn(),
  getSourceActiveMarks: vi.fn(() => new Set()),
  insertSourceAction: vi.fn(),
  pasteSourceText: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('./noteEditorContextMenuActions', () => ({
  applyRichFormatting: vi.fn(),
  cutSelection: vi.fn(),
  deleteRichSelection: vi.fn(),
  focusEditor: vi.fn(),
  getEditorViewForContextMenu: vi.fn(() => null),
  insertRichAction: vi.fn(),
  setSelectionAtPoint: vi.fn(),
}));

vi.mock('./noteEditorContextMenuClipboardActions', () => ({
  copyRichSelection: vi.fn(),
  pasteIntoEditor: vi.fn(),
}));

vi.mock('./noteEditorContextMenuSourceActions', () => ({
  ...mocks,
  getSourceBlockType: vi.fn(() => 'paragraph'),
}));

function ContextMenuHarness() {
  const rootRef = createRef<HTMLDivElement>();
  return (
    <div ref={rootRef}>
      <textarea data-note-source-editor="true" aria-label="Source" defaultValue="Selected source text" />
      <NoteEditorContextMenu rootRef={rootRef} />
    </div>
  );
}

function openSelectedSourceMenu(source: HTMLTextAreaElement) {
  source.setSelectionRange(0, source.value.length);
  fireEvent.contextMenu(source);
}

describe('NoteEditorContextMenu source action wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('routes all primary clipboard and deletion buttons', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;

    const actions = [
      ['editor.contextMenu.cut', mocks.cutSourceSelection, []],
      ['common.copy', mocks.copySourceSelection, ['markdown']],
      ['editor.contextMenu.paste', mocks.pasteSourceText, []],
      ['common.delete', mocks.deleteSourceSelection, []],
    ] as const;

    for (const [label, action, extraArgs] of actions) {
      openSelectedSourceMenu(source);
      fireEvent.click(screen.getByRole('menuitem', { name: label, exact: true }));
      expect(action).toHaveBeenLastCalledWith(source, ...extraArgs);
    }
  });

  it('routes every formatting icon to its source action', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    const actions = [
      ['shortcut.action.bold', 'bold'],
      ['shortcut.action.italic', 'italic'],
      ['shortcut.action.underline', 'underline'],
      ['shortcut.action.strikethrough', 'strike'],
      ['shortcut.action.inlineCode', 'code'],
      ['editor.highlight', 'highlight'],
      ['shortcut.action.link', 'link'],
      ['editor.blockType.blockquote', 'quote'],
      ['editor.blockType.orderedList', 'ordered-list'],
      ['editor.blockType.bulletList', 'bullet-list'],
      ['editor.blockType.taskList', 'task-list'],
    ] as const;

    for (const [label, action] of actions) {
      openSelectedSourceMenu(source);
      fireEvent.click(screen.getByRole('menuitem', { name: label, exact: true }));
      expect(mocks.applySourceFormatting).toHaveBeenLastCalledWith(source, action);
    }
  });

  it('routes every paragraph conversion', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;

    for (const blockType of [
      'heading1',
      'heading2',
      'heading3',
      'heading4',
      'heading5',
      'heading6',
      'paragraph',
    ]) {
      openSelectedSourceMenu(source);
      fireEvent.click(screen.getByRole('menuitem', { name: 'editor.blockType.paragraph' }));
      const submenu = screen.getAllByRole('menu')[1];
      fireEvent.click(within(submenu).getByRole('menuitemradio', {
        name: `editor.blockType.${blockType}`,
      }));
      expect(mocks.applySourceBlockType).toHaveBeenLastCalledWith(source, blockType);
    }
  });

  it('routes every copy format and plain-text paste action', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    const formats = [
      ['editor.contextMenu.copyAsMarkdown', 'markdown'],
      ['editor.contextMenu.copyAsHtml', 'html'],
      ['editor.contextMenu.copyAsRichText', 'rich'],
      ['editor.contextMenu.copyAsPlainText', 'plain'],
    ] as const;

    for (const [label, format] of formats) {
      openSelectedSourceMenu(source);
      fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' }));
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
      expect(mocks.copySourceSelection).toHaveBeenLastCalledWith(source, format);
    }

    openSelectedSourceMenu(source);
    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.pasteAsPlainText' }));
    expect(mocks.pasteSourceText).toHaveBeenLastCalledWith(source);
  });

  it('routes every insert command', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    const actions = [
      ['editor.slash.image', 'image'],
      ['editor.slash.callout', 'callout'],
      ['icon.emoji', 'emoji'],
      ['editor.slash.footnote', 'footnote'],
      ['editor.slash.footnoteDefinition', 'footnote-definition'],
      ['editor.contextMenu.linkReference', 'link-reference'],
      ['editor.slash.divider', 'divider'],
      ['editor.slash.table', 'table'],
      ['editor.blockType.codeBlock', 'code'],
      ['editor.slash.equation', 'formula'],
      ['editor.slash.inlineMath', 'inline-math'],
      ['editor.slash.tableOfContents', 'toc'],
      ['editor.slash.mermaidDiagram', 'mermaid'],
      ['editor.slash.htmlBlock', 'html-block'],
      ['editor.slash.abbreviation', 'abbreviation'],
      ['editor.slash.video', 'video'],
      ['editor.contextMenu.yamlFrontMatter', 'frontmatter'],
      ['editor.preview.insertParagraph (editor.preview.above)', 'paragraph-above'],
      ['editor.preview.insertParagraph (editor.preview.below)', 'paragraph-below'],
    ] as const;

    for (const [label, action] of actions) {
      openSelectedSourceMenu(source);
      fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.insert' }));
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
      expect(mocks.insertSourceAction).toHaveBeenLastCalledWith(source, action);
    }
  });
});
