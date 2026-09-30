import { createRef } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditorContextMenu } from './NoteEditorContextMenu';

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
  applySourceBlockType: vi.fn(),
  applySourceFormatting: vi.fn(),
  copySourceSelection: vi.fn(),
  cutSourceSelection: vi.fn(),
  deleteSourceSelection: vi.fn(),
  getSourceActiveMarks: vi.fn(() => new Set()),
  getSourceBlockType: vi.fn(() => 'paragraph'),
  insertSourceAction: vi.fn(),
  pasteSourceText: vi.fn(),
}));

function ContextMenuHarness() {
  const rootRef = createRef<HTMLDivElement>();
  return (
    <div ref={rootRef}>
      <textarea data-note-source-editor="true" aria-label="Source" />
      <div data-no-editor-drag-box="true">
        <textarea data-note-source-editor="true" aria-label="Editor chrome" />
      </div>
      <NoteEditorContextMenu rootRef={rootRef} />
    </div>
  );
}

describe('NoteEditorContextMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => vi.useRealTimers());

  it('opens for the source editor and dismisses on Escape', () => {
    render(<ContextMenuHarness />);
    fireEvent.contextMenu(screen.getByLabelText('Source'), { clientX: 120, clientY: 80 });

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByLabelText('editor.contextMenu.paste')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('exposes real shortcut labels on every icon action without native titles', () => {
    vi.useFakeTimers();
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    source.value = 'selected';
    source.setSelectionRange(0, source.value.length);
    fireEvent.contextMenu(source);

    const shortcuts = [
      ['editor.contextMenu.cut', 'Ctrl+X'],
      ['common.copy', 'Ctrl+C'],
      ['editor.contextMenu.paste', 'Ctrl+V'],
      ['common.delete', 'Delete'],
      ['shortcut.action.bold', 'Ctrl+B'],
      ['shortcut.action.italic', 'Ctrl+I'],
      ['shortcut.action.underline', 'Ctrl+U'],
      ['shortcut.action.strikethrough', 'Ctrl+Shift+5'],
      ['shortcut.action.inlineCode', 'Ctrl+Shift+`'],
      ['editor.highlight', 'Ctrl+H'],
      ['shortcut.action.link', 'Ctrl+K'],
      ['editor.blockType.blockquote', 'Ctrl+Shift+Q'],
      ['editor.blockType.orderedList', 'Ctrl+Shift+['],
      ['editor.blockType.bulletList', 'Ctrl+Shift+]'],
      ['editor.blockType.taskList', 'Ctrl+Shift+X'],
    ] as const;

    for (const [label, shortcut] of shortcuts) {
      const button = screen.getByRole('menuitem', { name: label, exact: true });
      expect(button).not.toHaveAttribute('title');
      expect(button.parentElement).toHaveAttribute('data-state', 'closed');

      fireEvent.pointerMove(button.parentElement!, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(300));
      expect(screen.getByRole('tooltip')).toHaveTextContent(label);
      expect(screen.getByRole('tooltip')).toHaveTextContent(shortcut);
      fireEvent.pointerLeave(button.parentElement!, { pointerType: 'mouse' });
      act(() => vi.runOnlyPendingTimers());
    }
  });

  it('keeps disabled icon actions inside hoverable tooltip triggers', () => {
    render(<ContextMenuHarness />);
    fireEvent.contextMenu(screen.getByLabelText('Source'));

    const cut = screen.getByRole('menuitem', { name: 'editor.contextMenu.cut' });
    expect(cut).toBeDisabled();
    expect(cut.parentElement).toHaveClass('editor-context-menu-icon-trigger-disabled');
  });

  it('shows every registered submenu shortcut beside its option', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    source.value = 'selected';
    source.setSelectionRange(0, source.value.length);
    fireEvent.contextMenu(source);

    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' }));
    let submenu = screen.getAllByRole('menu')[1];
    expect(within(submenu).getByRole('menuitem', {
      name: 'editor.contextMenu.copyAsMarkdown',
    })).toHaveTextContent('Ctrl+Shift+C');
    expect(within(submenu).getByRole('menuitem', {
      name: 'editor.contextMenu.pasteAsPlainText',
    })).toHaveTextContent('Ctrl+Shift+V');
    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.blockType.paragraph' }));
    submenu = screen.getAllByRole('menu')[1];
    expect(within(submenu).getByRole('menuitemradio', {
      name: 'editor.blockType.heading1',
    })).toHaveTextContent('Ctrl+1');
    expect(within(submenu).getByRole('menuitemradio', {
      name: 'editor.blockType.paragraph',
    })).toHaveTextContent('Ctrl+0');
    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.blockType.paragraph' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.insert' }));
    submenu = screen.getAllByRole('menu')[1];
    for (const [label, shortcut] of [
      ['editor.slash.image', 'Ctrl+Shift+I'],
      ['editor.slash.table', 'Ctrl+T'],
      ['editor.blockType.codeBlock', 'Ctrl+Shift+K'],
      ['editor.slash.equation', 'Ctrl+Shift+M'],
    ] as const) {
      expect(within(submenu).getByRole('menuitem', { name: label }))
        .toHaveTextContent(shortcut);
    }
  });

  it('orders insert actions from common content to advanced syntax', () => {
    render(<ContextMenuHarness />);
    fireEvent.contextMenu(screen.getByLabelText('Source'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.insert' }));

    const submenu = screen.getAllByRole('menu')[1];
    expect(within(submenu).getAllByRole('menuitem').map((item) => item.getAttribute('aria-label')))
      .toEqual([
        'editor.slash.image',
        'editor.slash.table',
        'editor.blockType.codeBlock',
        'editor.slash.divider',
        'editor.slash.callout',
        'icon.emoji',
        'editor.slash.equation',
        'editor.slash.inlineMath',
        'editor.slash.footnote',
        'editor.slash.footnoteDefinition',
        'editor.contextMenu.linkReference',
        'editor.slash.tableOfContents',
        'editor.slash.mermaidDiagram',
        'editor.slash.htmlBlock',
        'editor.slash.video',
        'editor.slash.abbreviation',
        'editor.contextMenu.yamlFrontMatter',
        'editor.preview.insertParagraph (editor.preview.above)',
        'editor.preview.insertParagraph (editor.preview.below)',
      ]);
    expect(within(submenu).getAllByRole('separator')).toHaveLength(3);
  });

  it('opens and closes a submenu without losing the root menu', () => {
    render(<ContextMenuHarness />);
    fireEvent.contextMenu(screen.getByLabelText('Source'));

    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' }));
    expect(screen.getAllByRole('menu')).toHaveLength(2);

    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' }));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('does not open over editor chrome and closes before a specialized menu consumes right click', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source');
    fireEvent.contextMenu(source);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    source.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { once: true });
    fireEvent.contextMenu(source);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.contextMenu(screen.getByLabelText('Editor chrome'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps a newly opened submenu when the previous hover-close timer fires', () => {
    vi.useFakeTimers();
    render(<ContextMenuHarness />);
    fireEvent.contextMenu(screen.getByLabelText('Source'));

    const copyTrigger = screen.getByRole('menuitem', { name: 'editor.contextMenu.copyAndPaste' })
      .closest('.editor-context-menu-submenu-trigger');
    const paragraphTrigger = screen.getByRole('menuitem', { name: 'editor.blockType.paragraph' })
      .closest('.editor-context-menu-submenu-trigger');
    expect(copyTrigger).not.toBeNull();
    expect(paragraphTrigger).not.toBeNull();

    fireEvent.mouseEnter(copyTrigger!);
    fireEvent.mouseLeave(copyTrigger!);
    fireEvent.mouseEnter(paragraphTrigger!);
    act(() => vi.advanceTimersByTime(150));

    expect(screen.getAllByRole('menu')).toHaveLength(2);
    expect(screen.getAllByRole('menuitemradio').at(-1)).toHaveAttribute('aria-checked', 'true');
  });

  it('does not dismiss while scrolling a long submenu', () => {
    render(<ContextMenuHarness />);
    fireEvent.contextMenu(screen.getByLabelText('Source'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'editor.contextMenu.insert' }));

    const submenu = screen.getAllByRole('menu')[1];
    fireEvent.scroll(submenu);
    expect(screen.getAllByRole('menu')).toHaveLength(2);
  });

  it('preserves a textarea selection through the native right-click sequence', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    source.value = 'keep this selection';
    source.setSelectionRange(0, 4);

    fireEvent.mouseDown(source, { button: 2 });
    source.setSelectionRange(source.value.length, source.value.length);
    fireEvent.contextMenu(source);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'common.copy', exact: true })).not.toBeDisabled();
  });

  it('preserves a textarea caret through the native right-click sequence', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    source.value = 'keep this caret';
    source.setSelectionRange(source.value.length, source.value.length);

    fireEvent.mouseDown(source, { button: 2 });
    source.setSelectionRange(2, 2);
    fireEvent.contextMenu(source);

    expect(source.selectionStart).toBe(source.value.length);
    expect(source.selectionEnd).toBe(source.value.length);
  });

  it('does not reuse an old mouse selection for a later keyboard context menu', () => {
    render(<ContextMenuHarness />);
    const source = screen.getByLabelText('Source') as HTMLTextAreaElement;
    source.value = 'fresh caret';
    source.setSelectionRange(0, 5);

    fireEvent.mouseDown(source, { button: 2 });
    fireEvent.contextMenu(source);
    fireEvent.keyDown(document, { key: 'Escape' });

    source.setSelectionRange(source.value.length, source.value.length);
    fireEvent.contextMenu(source);

    expect(source.selectionStart).toBe(source.value.length);
    expect(source.selectionEnd).toBe(source.value.length);
  });
});
