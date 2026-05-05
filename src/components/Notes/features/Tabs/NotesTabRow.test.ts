import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readNotesTabRowSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/Notes/features/Tabs/NotesTabRow.tsx'), 'utf8');
}

describe('NotesTabRow', () => {
  it('keeps the new note button hidden until the tab row is hovered or focused', () => {
    const source = readNotesTabRowSource();

    expect(source).toContain('group/tab-row flex h-full');
    expect(source).toContain('pointer-events-none flex h-7 w-7');
    expect(source).toContain('opacity-0');
    expect(source).toContain('group-hover/tab-row:pointer-events-auto');
    expect(source).toContain('group-hover/tab-row:opacity-100');
    expect(source).toContain('group-focus-within/tab-row:pointer-events-auto');
    expect(source).toContain('group-focus-within/tab-row:opacity-100');
  });
});
