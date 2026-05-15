import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssetSlice } from './assetSlice';
import { setCurrentVaultPath } from '../storage';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  list: vi.fn(),
}));

vi.mock('@/lib/assets/AssetService', () => ({
  AssetService: {
    list: mocks.list,
    upload: mocks.upload,
  },
}));

function createSliceHarness(overrides: Record<string, unknown> = {}) {
  let state: any;

  const set = (partial: any) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...nextState };
  };

  const get = () => state;
  const slice = createAssetSlice(set as never, get as never, {} as never);

  state = {
    ...slice,
    notesPath: '/vault',
    currentNote: { path: 'daily/demo.md', content: '' },
    assetList: [],
    uploadProgress: null,
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

describe('assetSlice uploadAsset', () => {
  beforeEach(() => {
    setCurrentVaultPath(null);
    vi.clearAllMocks();
    mocks.upload.mockImplementation(async (_file, _context, _config, _assets, onProgress) => {
      onProgress?.(70);
      return {
        success: true,
        path: './assets/demo.png',
        isDuplicate: false,
      };
    });
  });

  it('uses the active vault when notesPath has not been written to the notes store yet', async () => {
    setCurrentVaultPath('/vault');
    const harness = createSliceHarness({
      notesPath: '',
      currentNote: { path: 'daily/demo.md', content: '' },
    });
    const file = new File(['demo'], 'demo.png', { type: 'image/png' });

    await harness.getState().uploadAsset(file, 'daily/demo.md');

    expect(mocks.upload).toHaveBeenCalledWith(
      file,
      {
        vaultPath: '/vault',
        currentNotePath: 'daily/demo.md',
      },
      expect.any(Object),
      [],
      expect.any(Function),
    );
    expect(harness.getState().uploadProgress).toBe(70);
  });

  it('falls back to the current absolute note directory when no vault is selected', async () => {
    const harness = createSliceHarness({
      notesPath: '',
      currentNote: { path: '/outside/demo.md', content: '' },
    });
    const file = new File(['demo'], 'demo.png', { type: 'image/png' });

    await harness.getState().uploadAsset(file, '/outside/demo.md');

    expect(mocks.upload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        vaultPath: '/outside',
        currentNotePath: '/outside/demo.md',
      }),
      expect.any(Object),
      [],
      expect.any(Function),
    );
  });
});

describe('assetSlice loadAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([]);
  });

  it('does not add builtin covers when the picker is scoped to an external note directory', async () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      currentNote: { path: '/outside/demo.md', content: '' },
    });

    await harness.getState().loadAssets('/outside');

    expect(harness.getState().isLoadingAssets).toBe(false);
    expect(harness.getState().assetList.map((entry: { filename: string }) => entry.filename))
      .toEqual([]);
    expect(mocks.list).toHaveBeenCalledWith(
      {
        vaultPath: '/outside',
        currentNotePath: '/outside/demo.md',
      },
      expect.any(Object),
    );
  });

  it('includes user uploaded cover assets from the configured image location', async () => {
    mocks.list.mockResolvedValue([
      {
        filename: './assets/13_9.jpg',
        hash: 'uploaded-hash',
        size: 1224349,
        mimeType: 'image/jpeg',
        uploadedAt: '2026-05-08T01:47:54.361Z',
      },
    ]);
    const harness = createSliceHarness({
      notesPath: '',
      currentNote: { path: '/outside/demo.md', content: '' },
    });

    await harness.getState().loadAssets('/outside');

    expect(harness.getState().assetList.map((entry: { filename: string }) => entry.filename))
      .toContain('./assets/13_9.jpg');
    expect(harness.getState().assetList.map((entry: { filename: string }) => entry.filename))
      .not.toContain('@monet/5');
  });

  it('keeps existing assets visible while refreshing the library', async () => {
    let resolveList: (value: Array<{
      filename: string;
      hash: string;
      size: number;
      mimeType: string;
      uploadedAt: string;
    }>) => void = () => {};
    mocks.list.mockReturnValue(new Promise((resolve) => {
      resolveList = resolve;
    }));
    const harness = createSliceHarness({
      notesPath: '',
      currentNote: { path: '/outside/demo.md', content: '' },
      assetList: [
        {
          filename: './assets/existing.jpg',
          hash: 'existing',
          size: 10,
          mimeType: 'image/jpeg',
          uploadedAt: '2026-05-08T01:47:54.361Z',
        },
      ],
    });

    const load = harness.getState().loadAssets('/outside');

    expect(harness.getState().isLoadingAssets).toBe(true);
    expect(harness.getState().assetList.map((entry: { filename: string }) => entry.filename))
      .toEqual(['./assets/existing.jpg']);

    resolveList([]);
    await load;
  });

  it('coalesces concurrent loads for the same asset scope', async () => {
    let resolveList: (value: Array<{
      filename: string;
      hash: string;
      size: number;
      mimeType: string;
      uploadedAt: string;
    }>) => void = () => {};
    mocks.list.mockReturnValue(new Promise((resolve) => {
      resolveList = resolve;
    }));
    const harness = createSliceHarness({
      notesPath: '',
      currentNote: { path: '/outside/demo.md', content: '' },
    });

    const firstLoad = harness.getState().loadAssets('/outside');
    const secondLoad = harness.getState().loadAssets('/outside');

    resolveList([]);
    await Promise.all([firstLoad, secondLoad]);

    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});
