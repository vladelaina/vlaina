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
  it('keeps the new note button hidden until the title or tab row is hovered or focused', () => {
    const source = readNotesTabRowSource();
    const titleBarSource = readUnifiedTitleBarSource();
    const css = readIndexCssSource();

    expect(titleBarSource).toContain('vlaina-title-bar h-10');
    expect(titleBarSource).toContain('vlaina-drag-region vlaina-title-bar-center flex-1');
    expect(source).toContain("chatComposerPillSurfaceClass");
    expect(source).toContain('group/tab-row flex h-full w-full min-w-0 items-center gap-1');
    expect(source).toContain('vlaina-no-drag flex h-8 max-w-full min-w-0 items-center rounded-full');
    expect(source).toContain('flex h-8 max-w-full min-w-0 items-center rounded-full');
    expect(source).toContain('flex min-w-0 items-center overflow-x-auto');
    expect(source).not.toContain('flex min-w-0 max-w-[calc(100%-2rem)] items-center overflow-x-auto');
    expect(source).not.toContain('flex min-w-0 flex-1 items-center overflow-x-auto');
    expect(source).toContain('notes-tab-row-new-note-button vlaina-no-drag pointer-events-none');
    expect(source).toContain('pointer-events-none flex h-7 w-7');
    expect(source).toContain('h-7 w-7 shrink-0');
    expect(source).toContain('items-center justify-center rounded-full');
    expect(source).toContain('opacity-0');
    expect(css).toContain('.vlaina-title-bar-center:hover .notes-tab-row-new-note-button');
    expect(css).toContain('.vlaina-title-bar-center:focus-within .notes-tab-row-new-note-button');
    expect(source).toContain('group-hover/tab-row:pointer-events-auto');
    expect(source).toContain('group-hover/tab-row:opacity-100');
    expect(source).toContain('group-focus-within/tab-row:pointer-events-auto');
    expect(source).toContain('group-focus-within/tab-row:opacity-100');
    expect(source).toContain('shouldShowTitleTooltip');
    expect(source).toContain('{shouldShowTitleTooltip ? (');
    expect(source).toContain('label.scrollWidth > label.clientWidth + 1');
    expect(source).toContain('showArrow={false}');
    expect(source).toContain('rounded-[18px] px-3 py-2 text-xs text-[var(--chat-sidebar-text)]');
    expect(source).toContain('bg-[var(--chat-sidebar-row-hover)] text-[var(--chat-sidebar-text)]');
  });
});
