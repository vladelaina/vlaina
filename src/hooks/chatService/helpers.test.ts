import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMentionedNotesContext,
  loadMentionedNotes,
} from './helpers';

const hoisted = vi.hoisted(() => {
  const readFile = vi.fn();
  const storeRef: { state: any } = { state: null };

  const useNotesStore = {
    getState: () => storeRef.state,
  };

  return {
    readFile,
    storeRef,
    useNotesStore,
  };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readFile: hoisted.readFile,
  }),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/'),
}));

describe('chatService helpers', () => {
  beforeEach(() => {
    hoisted.readFile.mockReset();
    hoisted.storeRef.state = {
      currentNote: null,
      noteContentsCache: new Map(),
      notesPath: '/vault',
    };
  });

  it('loads mentioned note content from the notes cache', async () => {
    hoisted.storeRef.state.noteContentsCache.set('Cached.md', {
      content: '# Cached\nCached note body',
      modifiedAt: 1,
    });

    const notes = await loadMentionedNotes([
      { path: 'Cached.md', title: 'Cached' },
    ]);

    expect(notes).toEqual([
      {
        path: 'Cached.md',
        title: 'Cached',
        content: '# Cached\nCached note body',
      },
    ]);
    expect(hoisted.readFile).not.toHaveBeenCalled();
  });

  it('loads mentioned note content from disk when it is not cached', async () => {
    hoisted.readFile.mockResolvedValue('# Disk\nDisk note body');

    const notes = await loadMentionedNotes([
      { path: 'Disk.md', title: 'Disk' },
    ]);

    expect(hoisted.readFile).toHaveBeenCalledWith('/vault/Disk.md');
    expect(notes[0]?.content).toBe('# Disk\nDisk note body');
  });

  it('falls back to disk when the cached note content is empty', async () => {
    hoisted.storeRef.state.noteContentsCache.set('Skipped.md', {
      content: '',
      modifiedAt: 1,
    });
    hoisted.readFile.mockResolvedValue('# Skipped\nLoaded from disk');

    const notes = await loadMentionedNotes([
      { path: 'Skipped.md', title: 'Skipped' },
    ]);

    expect(hoisted.readFile).toHaveBeenCalledWith('/vault/Skipped.md');
    expect(notes[0]?.content).toBe('# Skipped\nLoaded from disk');
  });

  it('strips vlaina-managed frontmatter before sending mentioned notes', async () => {
    hoisted.storeRef.state.noteContentsCache.set('Managed.md', {
      content: [
        '---',
        'title: User title',
        'tags:',
        '  - project',
        'custom_field: keep me',
        'vlaina_cover: "@biva/1"',
        'vlaina_cover_x: 50',
        'vlaina_icon: "🪛"',
        'vlaina_updated: "2026-05-05T14:01:59.504Z"',
        'nested:',
        '  vlaina_note: user nested value',
        '---',
        '# Managed',
        'Visible body',
      ].join('\n'),
      modifiedAt: 1,
    });

    const notes = await loadMentionedNotes([
      { path: 'Managed.md', title: 'Managed' },
    ]);

    expect(notes[0]?.content).toBe([
      '---',
      'title: User title',
      'tags:',
      '  - project',
      'custom_field: keep me',
      'nested:',
      '  vlaina_note: user nested value',
      '---',
      '# Managed',
      'Visible body',
    ].join('\n'));
    const context = buildMentionedNotesContext(notes);
    expect(context).not.toContain('vlaina_cover');
    expect(context).not.toContain('vlaina_icon');
    expect(context).not.toContain('vlaina_updated');
    expect(notes[0]?.content).toContain('custom_field: keep me');
    expect(notes[0]?.content).toContain('  vlaina_note: user nested value');
  });

  it('removes hidden-only vlaina frontmatter before sending mentioned notes', async () => {
    hoisted.storeRef.state.noteContentsCache.set('HiddenOnly.md', {
      content: [
        '---',
        'vlaina_cover: "@biva/1"',
        'vlaina_icon: "🪛"',
        '---',
        '',
        '# Hidden',
        'Visible body',
      ].join('\n'),
      modifiedAt: 1,
    });

    const notes = await loadMentionedNotes([
      { path: 'HiddenOnly.md', title: 'HiddenOnly' },
    ]);

    expect(notes[0]?.content).toBe('# Hidden\nVisible body');
  });

  it('builds the notes context that is sent with the user request', () => {
    const context = buildMentionedNotesContext([
      {
        path: 'Cached.md',
        title: 'Cached',
        content: '# Cached\nCached note body',
      },
    ]);

    expect(context).toContain('Referenced notes (Markdown):');
    expect(context).toContain('## Cached');
    expect(context).toContain('Cached note body');
  });
});
