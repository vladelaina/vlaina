import { describe, expect, it, vi } from 'vitest';
import {
  NOTES_SIDEBAR_MAX_CONTENT_SEARCH_ENTRIES,
  queryNotesSidebarSearch,
} from './notesSidebarSearchResults';

describe('notesSidebarSearchResults content budgets', () => {
  it('caps content search entries when no earlier notes match', () => {
    const index = Array.from(
      { length: NOTES_SIDEBAR_MAX_CONTENT_SEARCH_ENTRIES + 1 },
      (_, index) => ({
        path: `notes/${String(index).padStart(5, '0')}.md`,
        name: `note-${index}.md`,
        preview: '',
      }),
    );
    const getNoteContent = vi.fn((path: string) =>
      path === `notes/${String(NOTES_SIDEBAR_MAX_CONTENT_SEARCH_ENTRIES).padStart(5, '0')}.md`
        ? 'needle'
        : 'plain text'
    );

    expect(queryNotesSidebarSearch(index, 'needle', getNoteContent)).toEqual([]);
    expect(getNoteContent).toHaveBeenCalledTimes(NOTES_SIDEBAR_MAX_CONTENT_SEARCH_ENTRIES);
  });
});
