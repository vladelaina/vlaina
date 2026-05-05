import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssetSlice } from './assetSlice';
import { setCurrentVaultPath } from '../storage';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
}));

vi.mock('@/lib/assets/AssetService', () => ({
  AssetService: {
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
