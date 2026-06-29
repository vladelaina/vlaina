import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteIcon } from './NoteIcon';

const mocked = vi.hoisted(() => ({
  resolveCoverAssetUrl: vi.fn(),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notesPath: string }) => unknown) => selector({ notesPath: '/vault' }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: { universalPreviewColor: null; universalPreviewTone: null }) => unknown) => selector({
    universalPreviewColor: null,
    universalPreviewTone: null,
  }),
}));

vi.mock('@/components/Notes/features/Cover/utils/resolveCoverAssetUrl', () => ({
  resolveCoverAssetUrl: mocked.resolveCoverAssetUrl,
}));

describe('NoteIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves note icon image paths against the vault', async () => {
    mocked.resolveCoverAssetUrl.mockResolvedValue('blob:vault-icon');

    render(<NoteIcon icon="assets/icons/demo.png" notePath="/vault/demo.md" size={20} />);

    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:vault-icon');
    });

    expect(mocked.resolveCoverAssetUrl).toHaveBeenCalledWith({
      assetPath: 'assets/icons/demo.png',
      vaultPath: '/vault',
      currentNotePath: '/vault/demo.md',
      replayAnimated: true,
    });
  });

  it('reuses resolved image icons after sidebar remounts', async () => {
    mocked.resolveCoverAssetUrl.mockResolvedValue('blob:stable-sidebar-icon');

    const firstRender = render(
      <NoteIcon icon="assets/icons/stable-sidebar.png" notePath="/vault/stable.md" size={20} />
    );

    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:stable-sidebar-icon');
    });

    firstRender.unmount();

    render(<NoteIcon icon="assets/icons/stable-sidebar.png" notePath="/vault/stable.md" size={20} />);

    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:stable-sidebar-icon');
    });

    expect(mocked.resolveCoverAssetUrl).toHaveBeenCalledTimes(1);
  });

  it('does not render a note icon image when the shared asset resolver rejects', async () => {
    mocked.resolveCoverAssetUrl.mockRejectedValue(new Error('cover-path-unsupported'));

    render(<NoteIcon icon="assets/icons/missing.png" notePath="/vault/demo.md" size={20} />);

    await waitFor(() => {
      expect(mocked.resolveCoverAssetUrl).toHaveBeenCalled();
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('does not render legacy img-scheme note icon images', async () => {
    mocked.resolveCoverAssetUrl.mockRejectedValue(new Error('cover-path-unsupported'));

    render(<NoteIcon icon="img:assets/icons/demo.png" notePath="/vault/demo.md" size={20} />);

    expect(mocked.resolveCoverAssetUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
