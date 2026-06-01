import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadNoteDocument, NoteWriteConflictError, saveNoteDocument } from './noteDocumentPersistence';
import { markExpectedExternalChange } from './externalChangeRegistry';
import { setCachedNoteContent } from './noteContentCache';

const adapter = {
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null>
  >(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

vi.mock('./externalChangeRegistry', () => ({
  markExpectedExternalChange: vi.fn(),
}));

describe('saveNoteDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes updated timestamp back into markdown frontmatter', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: [
          '---',
          'vlaina_created: 2026-04-14 18:00:00 +08:00',
          '---',
          '',
          '# Alpha',
        ].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_created: 2026-04-14 18:00:00 +08:00',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '# Alpha',
      ].join('\n')
    );
    expect(result.metadata).toEqual({
      createdAt: Date.parse('2026-04-14T10:00:00.000Z'),
      updatedAt: Date.parse('2026-04-15T10:00:00.000Z'),
    });
    expect(result.modifiedAt).toBe(123);

    vi.useRealTimers();
  });

  it('refreshes the expected external change marker after writing to cover delayed watch events', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockImplementation(async () => {
      vi.advanceTimersByTime(1500);
    });
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '# Alpha',
      },
      cache: new Map(),
    });

    expect(markExpectedExternalChange).toHaveBeenCalledTimes(2);
    expect(markExpectedExternalChange).toHaveBeenNthCalledWith(1, '/vault/alpha.md');
    expect(markExpectedExternalChange).toHaveBeenNthCalledWith(2, '/vault/alpha.md');

    vi.useRealTimers();
  });

  it('cleans internal editor break markers before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['# Alpha', '<br data-vlaina-empty-line="true"/>', 'Body'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      ['---', 'vlaina_updated: 2026-04-15 18:00:00 +08:00', '---', '', '# Alpha', '', 'Body'].join('\n')
    );
    expect(result.content).not.toContain('data-vlaina-empty-line');

    vi.useRealTimers();
  });

  it('converts internal user break markers to markdown hard breaks before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['Line one', '<br data-vlaina-user-br="true" />', 'Line two'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        'Line one\\',
        'Line two',
      ].join('\n')
    );
    expect(result.content).not.toContain('data-vlaina-user-br');

    vi.useRealTimers();
  });

  it('preserves user-authored line breaks before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['1', '2', '', '3', '4'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '1\\',
        '2',
        '',
        '3\\',
        '4',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('preserves editor-created empty paragraph runs before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['before', '', '', 'after', '', '', '', 'tail'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        'before',
        '',
        '',
        'after',
        '',
        '',
        '',
        'tail',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('removes terminal list item br placeholders before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '- 1<br />',
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '- 1',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('writes ordered list empty items and br spacer lines as plain markdown blank lines', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['8. before', '9. <br />', '<br />', '10. after'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '8. before',
        '9.',
        '',
        '10. after',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('writes multiple br spacer lines between list items as plain markdown blank lines', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['1. before', '<br />', '<br />', '<br />', '2. after'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '1. before',
        '',
        '',
        '',
        '2. after',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('keeps frontmatter body separator when saving an empty body', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: [
          '---',
          'vlaina_icon: "😃"',
          'vlaina_updated: 2026-04-14 18:00:00 +08:00',
          '---',
          '',
        ].join('\n'),
      },
      cache: new Map(),
    });

    const expected = [
      '---',
      'vlaina_icon: "😃"',
      'vlaina_updated: 2026-04-15 18:00:00 +08:00',
      '---',
      '',
    ].join('\n');
    expect(adapter.writeFile).toHaveBeenCalledWith('/vault/alpha.md', expected);
    expect(result.content).toBe(expected);

    vi.useRealTimers();
  });

  it('canonicalizes supported inline html text before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '<sup>a < b & c</sup>',
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '<sup>a &lt; b &amp; c</sup>',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('normalizes custom editor markdown syntax before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: [
          '\\==highlight==',
          '',
          '\\*[ABBR]: Full phrase',
          '',
          '[^1]: <br />',
          '',
          '| A | B |',
          '| - | - |',
          '| <br /> | <br /> |',
        ].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '==highlight==',
        '',
        '*[ABBR]: Full phrase',
        '',
        '[^1]:',
        '',
        '| A | B |',
        '| - | - |',
        '|   |   |',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('cleans internal editor break markers when loading markdown', async () => {
    adapter.readFile.mockResolvedValue(['# Alpha', '<br data-vlaina-empty-line="true"/>', 'Body'].join('\n'));
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map(),
    });

    expect(result.content).toBe(['# Alpha', '', 'Body'].join('\n'));
    expect(result.nextCache.get('alpha.md')?.content).toBe(['# Alpha', '', 'Body'].join('\n'));
  });

  it('preserves markdown blank lines between list items when loading markdown', async () => {
    const markdown = ['- one', '', '', '', '- two'].join('\n');
    adapter.readFile.mockResolvedValue(markdown);
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map(),
    });

    expect(result.content).toBe(markdown);
    expect(result.nextCache.get('alpha.md')?.content).toBe(markdown);
  });

  it('rejects loading relative paths that escape the vault', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: '../secret.md',
      cache: new Map(),
    })).rejects.toThrow('Path must stay inside the current vault.');

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('rejects loading oversized markdown files before reading content', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 123, size: 11 * 1024 * 1024 });

    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'huge.md',
      cache: new Map(),
    })).rejects.toThrow('Note file is too large to open.');

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('rejects cached markdown that is too complex for the editor', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'many-lines.md',
      cache: new Map([
        ['many-lines.md', {
          content: `${'x\n'.repeat(120_001)}x`,
          modifiedAt: 123,
        }],
      ]),
    })).rejects.toThrow('Note file is too complex to open safely.');

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('rejects markdown with an extreme single line before normalization', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 123, size: 600 * 1024 });
    adapter.readFile.mockResolvedValue('x'.repeat(512 * 1024 + 1));

    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'long-line.md',
      cache: new Map(),
    })).rejects.toThrow('Note file is too complex to open safely.');
  });

  it('cleans internal user break markers when loading markdown', async () => {
    adapter.readFile.mockResolvedValue(['Line one', '<br data-vlaina-user-br="true" />', 'Line two'].join('\n'));
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map(),
    });

    expect(result.content).toBe(['Line one\\', 'Line two'].join('\n'));
    expect(result.nextCache.get('alpha.md')?.content).toBe(['Line one\\', 'Line two'].join('\n'));
  });

  it('cleans internal editor break markers from cached markdown', async () => {
    const cachedContent = ['# Alpha', '<br data-vlaina-empty-line="true" />', 'Body'].join('\n');
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });
    adapter.readFile.mockResolvedValue(cachedContent);
    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map([
        ['alpha.md', {
          content: cachedContent,
          modifiedAt: 123,
        }],
      ]),
    });

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(result.content).toBe(['# Alpha', '', 'Body'].join('\n'));
    expect(result.nextCache.get('alpha.md')?.content).toBe(['# Alpha', '', 'Body'].join('\n'));
    expect(result.modifiedAt).toBe(123);
  });

  it('uses freshly prefetched cached markdown without another disk stat', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Fresh', 100, {
        updateBaseline: true,
        freshUntil: 2000,
      }),
    });

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(result.content).toBe('# Fresh');
    expect(result.modifiedAt).toBe(100);

    vi.useRealTimers();
  });

  it('revalidates cached markdown after the fresh prefetch window expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2500);
    adapter.stat.mockResolvedValue({ modifiedAt: 200 });
    adapter.readFile.mockResolvedValue('# Updated after prefetch');

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Fresh but expired', 100, {
        updateBaseline: true,
        freshUntil: 2000,
      }),
    });

    expect(adapter.stat).toHaveBeenCalledWith('/vault/alpha.md');
    expect(adapter.readFile).toHaveBeenCalledWith('/vault/alpha.md');
    expect(result.content).toBe('# Updated after prefetch');
    expect(result.modifiedAt).toBe(200);

    vi.useRealTimers();
  });

  it('refreshes cached markdown when the disk modified timestamp changed before opening', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 200 });
    adapter.readFile.mockResolvedValue('# Updated by another window');

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map([
        ['alpha.md', {
          content: '# Cached before external edit',
          modifiedAt: 100,
        }],
      ]),
    });

    expect(adapter.readFile).toHaveBeenCalledWith('/vault/alpha.md');
    expect(result.content).toBe('# Updated by another window');
    expect(result.modifiedAt).toBe(200);
    expect(result.nextCache.get('alpha.md')).toEqual({
      content: '# Updated by another window',
      modifiedAt: 200,
    });
  });

  it('keeps dirty tab cached markdown even when disk changed before opening', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 200 });
    adapter.readFile.mockResolvedValue('# Updated by another window');

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map([
        ['alpha.md', {
          content: '# Unsaved local tab edit',
          modifiedAt: 100,
        }],
      ]),
      allowStaleCachedContent: true,
    });

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(result.content).toBe('# Unsaved local tab edit');
    expect(result.modifiedAt).toBe(100);
  });

  it('refuses to overwrite a note that changed on disk after it was loaded', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 200 });
    adapter.readFile.mockResolvedValue('# External edit');

    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '# Local edit',
      },
      cache: new Map([['alpha.md', { content: '# Loaded', modifiedAt: 100 }]]),
    })).rejects.toBeInstanceOf(NoteWriteConflictError);

    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('merges non-overlapping local and disk edits before saving', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.stat
      .mockResolvedValueOnce({ modifiedAt: 200 })
      .mockResolvedValueOnce({ modifiedAt: 201 });
    adapter.readFile.mockResolvedValue([
      '# Title',
      '',
      'Disk edit',
      '',
      'Shared ending',
    ].join('\n'));
    adapter.writeFile.mockResolvedValue();

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: [
          '# Title',
          '',
          'Loaded middle',
          '',
          'Local ending',
        ].join('\n'),
      },
      cache: new Map([[
        'alpha.md',
        {
          content: [
            '# Title',
            '',
            'Loaded middle',
            '',
            'Shared ending',
          ].join('\n'),
          modifiedAt: 100,
        },
      ]]),
    });

    const expectedContent = [
      '---',
      'vlaina_updated: 2026-04-15 18:00:00 +08:00',
      '---',
      '',
      '# Title',
      '',
      'Disk edit',
      '',
      'Local ending',
    ].join('\n');
    expect(adapter.writeFile).toHaveBeenCalledWith('/vault/alpha.md', expectedContent);
    expect(result.content).toBe(expectedContent);
    expect(result.modifiedAt).toBe(201);

    vi.useRealTimers();
  });

  it('refuses to overwrite a note whose disk content changed with the same modified timestamp', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 100 });
    adapter.readFile.mockResolvedValue('# External same timestamp edit');
    let cache = setCachedNoteContent(new Map(), 'alpha.md', '# Loaded', 100, {
      updateBaseline: true,
    });
    cache = setCachedNoteContent(cache, 'alpha.md', '# Local edit', 100);

    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '# Local edit',
      },
      cache,
    })).rejects.toBeInstanceOf(NoteWriteConflictError);

    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('rejects saving relative paths that escape the vault', async () => {
    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: '../secret.md',
        content: '# Secret',
      },
      cache: new Map(),
    })).rejects.toThrow('Path must stay inside the current vault.');

    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('saves local edits when only the disk modified timestamp changed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.stat
      .mockResolvedValueOnce({ modifiedAt: 200 })
      .mockResolvedValueOnce({ modifiedAt: 201 });
    adapter.readFile.mockResolvedValue('# Loaded');
    adapter.writeFile.mockResolvedValue();

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '# Local edit',
      },
      cache: new Map([['alpha.md', { content: '# Loaded', modifiedAt: 100 }]]),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-15 18:00:00 +08:00',
        '---',
        '',
        '# Local edit',
      ].join('\n')
    );
    expect(result.modifiedAt).toBe(201);
    expect(result.nextCache.get('alpha.md')).toEqual({
      content: result.content,
      modifiedAt: 201,
    });

    vi.useRealTimers();
  });

  it('saves local edits when the disk only changed the managed updated timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T10:00:00.000Z'));
    adapter.stat
      .mockResolvedValueOnce({ modifiedAt: 200 })
      .mockResolvedValueOnce({ modifiedAt: 201 });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: 2026-04-16 18:00:00 +08:00',
      '---',
      '',
      '# Loaded',
    ].join('\n'));
    adapter.writeFile.mockResolvedValue();

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: [
          '---',
          'vlaina_updated: 2026-04-15 18:00:00 +08:00',
          '---',
          '',
          '# Local edit',
        ].join('\n'),
      },
      cache: new Map([[
        'alpha.md',
        {
          content: [
            '---',
            'vlaina_updated: 2026-04-15 18:00:00 +08:00',
            '---',
            '',
            '# Loaded',
          ].join('\n'),
          modifiedAt: 100,
        },
      ]]),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        '---',
        'vlaina_updated: 2026-04-17 18:00:00 +08:00',
        '---',
        '',
        '# Local edit',
      ].join('\n')
    );
    expect(result.modifiedAt).toBe(201);

    vi.useRealTimers();
  });

  it('treats a modified timestamp with matching disk content as already saved', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 200 });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: 2026-04-15 18:00:00 +08:00',
      '---',
      '',
      '# Loaded',
    ].join('\n'));

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: [
          '---',
          'vlaina_updated: 2026-04-15 18:00:00 +08:00',
          '---',
          '',
          '# Loaded',
        ].join('\n'),
      },
      cache: new Map([['alpha.md', { content: '# Loaded', modifiedAt: 100 }]]),
    });

    expect(adapter.writeFile).not.toHaveBeenCalled();
    expect(result.modifiedAt).toBe(200);
    expect(result.content).toBe([
      '---',
      'vlaina_updated: 2026-04-15 18:00:00 +08:00',
      '---',
      '',
      '# Loaded',
    ].join('\n'));
    expect(result.nextCache.get('alpha.md')).toEqual({
      content: result.content,
      modifiedAt: 200,
    });
  });
});
