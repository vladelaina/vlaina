import { beforeEach, describe, expect, it, vi } from 'vitest';

const MAX_PICKED_IMAGE_BYTES = 50 * 1024 * 1024;

const mocks = vi.hoisted(() => ({
  handleEditorImageFiles: vi.fn(),
  openDialog: vi.fn(),
  readBinaryFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.split(/[\\/]/).pop() ?? '',
  getStorageAdapter: () => ({
    readBinaryFile: mocks.readBinaryFile,
    stat: mocks.stat,
  }),
}));

vi.mock('@/lib/storage/dialog', () => ({
  openDialog: mocks.openDialog,
}));

vi.mock('../image-upload/handleEditorImageFiles', () => ({
  handleEditorImageFiles: mocks.handleEditorImageFiles,
}));

import { insertImageFromFilePicker } from './slashFileCommands';

function createEditorContext() {
  const tr = {
    scrollIntoView: vi.fn(function () {
      return tr;
    }),
    setSelection: vi.fn(function () {
      return tr;
    }),
  };
  const bookmark = {
    resolve: vi.fn(() => ({ from: 1, to: 1 })),
  };
  const doc = {
    eq: vi.fn((other: unknown) => other === doc),
  };
  const selection = {
    eq: vi.fn((other: unknown) => other === selection),
    getBookmark: vi.fn(() => bookmark),
  };
  const view = {
    dispatch: vi.fn(),
    state: {
      doc,
      selection,
      tr,
    },
  };

  return {
    ctx: {
      get: vi.fn(() => view),
    },
    tr,
    view,
  };
}

describe('insertImageFromFilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleEditorImageFiles.mockResolvedValue(true);
    mocks.openDialog.mockResolvedValue('/notesRoot/assets/no-size.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.stat.mockResolvedValue({ isFile: true });
  });

  it('reads selected images with a byte limit when stat omits size', async () => {
    const { ctx, view } = createEditorContext();

    await insertImageFromFilePicker(ctx as never);

    expect(mocks.readBinaryFile).toHaveBeenCalledWith('/notesRoot/assets/no-size.png', MAX_PICKED_IMAGE_BYTES);
    expect(mocks.handleEditorImageFiles).toHaveBeenCalledTimes(1);
    const [[files, handledView]] = mocks.handleEditorImageFiles.mock.calls;
    expect(handledView).toBe(view);
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toBe('no-size.png');
    expect(files[0].size).toBe(3);
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(mocks.handleEditorImageFiles.mock.calls[0]?.[3]).toEqual({ from: 1, to: 1 });
  });

  it('does not restore the saved selection after the editor document changes', async () => {
    const { ctx, view } = createEditorContext();
    const changedDoc = {
      eq: vi.fn((other: unknown) => other === changedDoc),
    };
    mocks.openDialog.mockImplementation(async () => {
      view.state.doc = changedDoc;
      return '/notesRoot/assets/changed.png';
    });

    await insertImageFromFilePicker(ctx as never);

    expect(mocks.handleEditorImageFiles).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
