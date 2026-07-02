import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readNotesTabRowSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/Notes/features/Tabs/NotesTabRow.tsx'), 'utf8');
}

function readUnifiedTitleBarSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/layout/shell/UnifiedTitleBar.tsx'), 'utf8');
}

function readIndexCssSource() {
  return readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
}

describe('NotesTabRow', () => {
  it('hides the empty tab surface and only reveals the new note button when needed', () => {
    const source = readNotesTabRowSource();
    const titleBarSource = readUnifiedTitleBarSource();
    const css = readIndexCssSource();

    expect(titleBarSource).toContain('app-title-bar h-10');
    expect(titleBarSource).toContain('app-drag-region app-title-bar-center flex-1');
    expect(source).toContain("chatComposerGhostIconButtonClass");
    expect(source).toContain("chatComposerPillSurfaceClass");
    expect(source).toContain('group/tab-row flex h-full w-full min-w-0 items-center gap-1');
    expect(source).toContain('app-no-drag flex h-8 max-w-full min-w-0 items-center rounded-full');
    expect(source).toContain('flex h-8 max-w-full min-w-0 items-center rounded-full');
    expect(source).toContain('const hasOpenTabs = openTabs.length > 0;');
    expect(source).toContain('{hasOpenTabs ? (');
    expect(source).toContain('flex min-w-0 items-center overflow-x-auto');
    expect(source).not.toContain('flex min-w-0 max-w-[var(--vlaina-width-dialog-default)] items-center overflow-x-auto');
    expect(source).not.toContain('flex min-w-0 flex-1 items-center overflow-x-auto');
    expect(source).toContain('notes-tab-row-new-note-button app-no-drag flex h-7');
    expect(source).toContain('notes-tab-row-history-controls flex h-7 w-14');
    expect(source).toContain('notes-tab-row-history-button app-no-drag flex h-7 w-7');
    expect(source).toContain('navigateBackInNoteHistory');
    expect(source).toContain('navigateForwardInNoteHistory');
    expect(source.indexOf('notes-tab-row-history-controls flex h-7 w-14')).toBeGreaterThan(
      source.indexOf('notes-tab-row-new-note-button app-no-drag flex h-7')
    );
    expect(source).toContain('flex h-7 w-7');
    expect(source).toContain('h-7 w-7 shrink-0');
    expect(source).toContain('items-center justify-center rounded-full');
    expect(source).toContain('opacity-[var(--vlaina-opacity-0)]');
    expect(source).toContain('pointer-events-auto opacity-[var(--vlaina-opacity-100)]');
    expect(css).toContain('.app-title-bar-center:hover .notes-tab-row-new-note-button');
    expect(css).toContain('.app-title-bar-center:focus-within .notes-tab-row-new-note-button');
    expect(source).toContain('group-hover/tab-row:pointer-events-auto');
    expect(source).toContain('group-hover/tab-row:opacity-[var(--vlaina-opacity-100)]');
    expect(source).toContain('group-focus-within/tab-row:pointer-events-auto');
    expect(source).toContain('group-focus-within/tab-row:opacity-[var(--vlaina-opacity-100)]');
    expect(source).not.toContain('hover:bg-[var(--vlaina-color-control-hover-bg)]');
    expect(source).not.toContain('hover:text-[var(--vlaina-color-control-hover-fg)]');
    expect(source).toContain('const currentNotesRootPath = useNotesRootStore((s) => s.currentNotesRoot?.path ?? null);');
    expect(source).toContain('const hasOpenedFolder = Boolean(currentNotesRootPath && notesPath === currentNotesRootPath && rootFolderPath === currentNotesRootPath);');
    expect(source).toContain('{hasOpenedFolder ? (');
    expect(source).toContain('shouldShowTitleTooltip');
    expect(source).toContain('{shouldShowTitleTooltip ? (');
    expect(source).toContain('label.scrollWidth > label.clientWidth + 1');
    expect(source).toContain('showArrow={false}');
    expect(source).toContain('rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]');
    expect(source).toContain('bg-[var(--vlaina-sidebar-chat-row-hover)] text-[var(--vlaina-sidebar-chat-text)]');
  });
});
