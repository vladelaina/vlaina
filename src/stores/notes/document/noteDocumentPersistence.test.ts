import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadNoteDocument, NoteWriteConflictError, saveNoteDocument } from './noteDocumentPersistence';

const adapter = {
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null } | null>
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
          'vlaina_created: "2026-04-14T10:00:00.000Z"',
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
        'vlaina_created: "2026-04-14T10:00:00.000Z"',
        'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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

  it('cleans internal editor break markers before writing markdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: ['# Alpha', '<br date-vlaianempt-line="true"/>', 'Body'].join('\n'),
      },
      cache: new Map(),
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      ['---', 'vlaina_updated: "2026-04-15T10:00:00.000Z"', '---', '', '# Alpha', '', 'Body'].join('\n')
    );
    expect(result.content).not.toContain('vlaian');

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
        'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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
        'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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
          'vlaina_updated: "2026-04-14T10:00:00.000Z"',
          '---',
          '',
        ].join('\n'),
      },
      cache: new Map(),
    });

    const expected = [
      '---',
      'vlaina_icon: "😃"',
      'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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
        'vlaina_updated: "2026-04-15T10:00:00.000Z"',
        '---',
        '',
        '<sup>a &lt; b &amp; c</sup>',
      ].join('\n')
    );

    vi.useRealTimers();
  });

  it('cleans internal editor break markers when loading markdown', async () => {
    adapter.readFile.mockResolvedValue(['# Alpha', '<br date-vlaianempt-line="true"/>', 'Body'].join('\n'));
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map(),
    });

    expect(result.content).toBe(['# Alpha', '', 'Body'].join('\n'));
    expect(result.nextCache.get('alpha.md')?.content).toBe(['# Alpha', '', 'Body'].join('\n'));
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
    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: new Map([
        ['alpha.md', {
          content: ['# Alpha', '<br data-vlaina-empty-line="true" />', 'Body'].join('\n'),
          modifiedAt: 123,
        }],
      ]),
    });

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(result.content).toBe(['# Alpha', '', 'Body'].join('\n'));
    expect(result.nextCache.get('alpha.md')?.content).toBe(['# Alpha', '', 'Body'].join('\n'));
    expect(result.modifiedAt).toBe(123);
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

  it('treats a modified timestamp with matching disk content as already saved', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: 200 });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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
          'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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
      'vlaina_updated: "2026-04-15T10:00:00.000Z"',
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
