import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDraftSavePath, resolveDraftSaveLocation } from './draftNoteSave';

const mocks = vi.hoisted(() => ({
  saveDialog: vi.fn(),
}));

vi.mock('@/lib/storage/dialog', () => ({
  saveDialog: mocks.saveDialog,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.split('/').pop() ?? path,
  getExtension: (path: string) => {
    const fileName = path.split('/').pop() ?? path;
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1);
  },
  getParentPath: (path: string) => {
    const index = path.lastIndexOf('/');
    return index <= 0 ? '' : path.slice(0, index);
  },
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/|$)/);
    const root = driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '';
    if (!root) return path;

    const parts: string[] = [];
    const rest = normalized.slice(root.length).replace(/^\/+/, '');
    for (const part of rest.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }

    return parts.length > 0 ? `${root}${parts.join('/')}` : root;
  },
  normalizePath: (path: string) => path,
}));

describe('draft note save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveDialog.mockResolvedValue('/home/vladelaina/sdf.md');
  });

  it('authorizes the selected file parent directory so it can become the notes workspace', async () => {
    await chooseDraftSavePath('', { parentPath: null, name: 'sdf' });

    expect(mocks.saveDialog).toHaveBeenCalledWith({
      title: 'Save Note As',
      defaultPath: 'sdf.md',
      authorizeParentDirectory: true,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
    });
  });

  it('keeps user dot folders usable when resolving draft save locations inside the notesRoot', () => {
    expect(resolveDraftSaveLocation('/notesRoot/.notes/alpha.md', '/notesRoot')).toEqual({
      absolutePath: '/notesRoot/.notes/alpha.md',
      relativePath: '.notes/alpha.md',
    });
  });

  it('normalizes selected paths before deciding whether they are inside the notesRoot', () => {
    expect(resolveDraftSaveLocation('/notesRoot/docs/../alpha.md', '/notesRoot')).toEqual({
      absolutePath: '/notesRoot/docs/../alpha.md',
      relativePath: 'alpha.md',
    });
    expect(resolveDraftSaveLocation('/notesRoot/../secret.md', '/notesRoot')).toEqual({
      absolutePath: '/notesRoot/../secret.md',
      relativePath: null,
    });
  });

  it('resolves root notesRoot and Windows case variants as notes-root-relative save locations', () => {
    expect(resolveDraftSaveLocation('/alpha.md', '/')).toEqual({
      absolutePath: '/alpha.md',
      relativePath: 'alpha.md',
    });
    expect(resolveDraftSaveLocation('c:/NotesRoot/docs/alpha.md', 'C:/NotesRoot')).toEqual({
      absolutePath: 'c:/NotesRoot/docs/alpha.md',
      relativePath: 'docs/alpha.md',
    });
  });

  it('rejects internal folders when resolving draft save locations inside the notesRoot', () => {
    expect(() => resolveDraftSaveLocation('/notesRoot/.vlaina/secret.md', '/notesRoot'))
      .toThrow('Path must not be inside an internal notes folder.');
    expect(() => resolveDraftSaveLocation('/notesRoot/docs/.git/config.md', '/notesRoot'))
      .toThrow('Path must not be inside an internal notes folder.');
    expect(() => resolveDraftSaveLocation('/notesRoot/docs/.GIT/config.md', '/notesRoot'))
      .toThrow('Path must not be inside an internal notes folder.');
  });
});
