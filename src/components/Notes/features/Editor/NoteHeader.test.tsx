import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteHeader } from './NoteHeader';

const mocks = vi.hoisted(() => {
  const loadAssets = vi.fn();
  const resolveCoverAssetUrl = vi.fn();
  const uploadAsset = vi.fn();
  const notesState = {
    currentNote: { path: 'notes/demo.md', content: '# Demo' },
    setNoteIcon: vi.fn(),
    setNoteIconSize: vi.fn(),
    isNewlyCreated: false,
    noteMetadata: { notes: {} },
    draftNotes: {},
    notesPath: '/vault',
    assetList: [
      {
        filename: 'assets/logo.png',
        hash: '',
        size: 128,
        mimeType: 'image/png',
        uploadedAt: '2026-05-12T10:51:54.912Z',
      },
    ],
    loadAssets,
    uploadAsset,
    noteIconSize: 60,
    getDisplayName: vi.fn(() => 'Demo'),
  };

  return {
    heroProps: null as any,
    loadAssets,
    notesState,
    resolveCoverAssetUrl,
    uploadAsset,
  };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof mocks.notesState) => unknown) => selector(mocks.notesState),
}));

vi.mock('@/components/common/HeroIconHeader', () => ({
  HeroIconHeader: (props: any) => {
    mocks.heroProps = props;
    return <div data-testid="hero-icon-header" />;
  },
}));

vi.mock('@/components/common/UniversalIconPicker/randomEmoji', () => ({
  getRandomHeaderEmoji: () => 'misc.star',
}));

vi.mock('../Cover/utils/resolveCoverAssetUrl', () => ({
  resolveCoverAssetUrl: mocks.resolveCoverAssetUrl,
}));

describe('NoteHeader', () => {
  beforeEach(() => {
    mocks.heroProps = null;
    mocks.loadAssets.mockReset();
    mocks.loadAssets.mockResolvedValue(undefined);
    mocks.resolveCoverAssetUrl.mockReset();
    mocks.resolveCoverAssetUrl.mockResolvedValue('blob:logo');
    mocks.uploadAsset.mockReset();
    mocks.uploadAsset.mockResolvedValue({
      success: true,
      path: 'assets/uploaded-logo.png',
      isDuplicate: false,
    });
  });

  it('uses the note asset library for header icon images', async () => {
    render(<NoteHeader coverUrl={null} onAddCover={vi.fn()} />);

    expect(mocks.heroProps.customIcons).toEqual([
      {
        id: 'assets/logo.png',
        url: 'assets/logo.png',
        name: 'logo.png',
        createdAt: Date.parse('2026-05-12T10:51:54.912Z'),
      },
    ]);

    await mocks.heroProps.onIconPickerOpen();
    expect(mocks.loadAssets).toHaveBeenCalledWith('/vault');

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    await expect(mocks.heroProps.onUploadFile(file)).resolves.toEqual({
      success: true,
      url: 'assets/uploaded-logo.png',
    });
    expect(mocks.uploadAsset).toHaveBeenCalledWith(file, 'notes/demo.md');

    await expect(mocks.heroProps.imageLoader('assets/logo.png')).resolves.toBe('blob:logo');
    expect(mocks.resolveCoverAssetUrl).toHaveBeenCalledWith({
      assetPath: 'assets/logo.png',
      vaultPath: '/vault',
      currentNotePath: 'notes/demo.md',
      replayAnimated: true,
    });
  });
});
