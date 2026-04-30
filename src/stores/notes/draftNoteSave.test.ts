import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDraftSavePath } from './draftNoteSave';

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
  normalizePath: (path: string) => path,
  relativePath: (_base: string, target: string) => target,
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
});
