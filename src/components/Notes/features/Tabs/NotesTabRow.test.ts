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
    expect(titleBarSource).toContain('vlaina-no-drag vlaina-title-bar-center flex-1');
    expect(source).toContain('group/tab-row flex h-full w-full');
    expect(source).toContain('flex min-w-0 max-w-[calc(100%-2rem)] items-center overflow-x-auto');
    expect(source).not.toContain('flex min-w-0 flex-1 items-center overflow-x-auto');
    expect(source).toContain('notes-tab-row-new-note-button pointer-events-none');
    expect(source).toContain('pointer-events-none flex h-7 w-7');
    expect(source).toContain('h-7 w-7 shrink-0');
    expect(source).toContain('opacity-0');
    expect(css).toContain('.vlaina-title-bar-center:hover .notes-tab-row-new-note-button');
    expect(css).toContain('.vlaina-title-bar-center:focus-within .notes-tab-row-new-note-button');
    expect(source).toContain('group-hover/tab-row:pointer-events-auto');
    expect(source).toContain('group-hover/tab-row:opacity-100');
    expect(source).toContain('group-focus-within/tab-row:pointer-events-auto');
    expect(source).toContain('group-focus-within/tab-row:opacity-100');
  });
});
