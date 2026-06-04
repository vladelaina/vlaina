import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteIcon } from './NoteIcon';

const mocked = vi.hoisted(() => ({
  loadAppIconImageSrc: vi.fn(),
  resolveExistingVaultAssetPath: vi.fn(),
  loadImageAsBlob: vi.fn(),
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

vi.mock('@/components/common/AppIcon', () => ({
  loadAppIconImageSrc: mocked.loadAppIconImageSrc,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveExistingVaultAssetPath: mocked.resolveExistingVaultAssetPath,
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: mocked.loadImageAsBlob,
}));

describe('NoteIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads absolute global custom icon images through the app icon loader', async () => {
    mocked.loadAppIconImageSrc.mockResolvedValue('blob:global-icon');

    render(
      <NoteIcon
        icon="img:/app/.vlaina/assets/icons/demo.png"
        notePath="/vault/demo.md"
        size={20}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:global-icon');
    });

    expect(mocked.loadAppIconImageSrc).toHaveBeenCalledWith('img:/app/.vlaina/assets/icons/demo.png');
    expect(mocked.resolveExistingVaultAssetPath).not.toHaveBeenCalled();
    expect(mocked.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('loads absolute global custom icon images with a case-insensitive image scheme', async () => {
    mocked.loadAppIconImageSrc.mockResolvedValue('blob:global-icon');

    render(
      <NoteIcon
        icon="IMG:/app/.vlaina/assets/icons/demo.png"
        notePath="/vault/demo.md"
        size={20}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:global-icon');
    });

    expect(mocked.loadAppIconImageSrc).toHaveBeenCalledWith('IMG:/app/.vlaina/assets/icons/demo.png');
    expect(mocked.resolveExistingVaultAssetPath).not.toHaveBeenCalled();
    expect(mocked.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('keeps resolving relative note icon images against the vault', async () => {
    mocked.resolveExistingVaultAssetPath.mockResolvedValue('/vault/assets/icons/demo.png');
    mocked.loadImageAsBlob.mockResolvedValue('blob:vault-icon');

    render(<NoteIcon icon="img:assets/icons/demo.png" notePath="/vault/demo.md" size={20} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:vault-icon');
    });

    expect(mocked.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'assets/icons/demo.png',
      '/vault/demo.md',
    );
    expect(mocked.loadImageAsBlob).toHaveBeenCalledWith('/vault/assets/icons/demo.png');
    expect(mocked.loadAppIconImageSrc).not.toHaveBeenCalled();
  });

  it('keeps resolving relative note icon images with a case-insensitive image scheme', async () => {
    mocked.resolveExistingVaultAssetPath.mockResolvedValue('/vault/assets/icons/demo.png');
    mocked.loadImageAsBlob.mockResolvedValue('blob:vault-icon');

    render(<NoteIcon icon="IMG:assets/icons/demo.png" notePath="/vault/demo.md" size={20} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'icon' })).toHaveAttribute('src', 'blob:vault-icon');
    });

    expect(mocked.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'assets/icons/demo.png',
      '/vault/demo.md',
    );
    expect(mocked.loadImageAsBlob).toHaveBeenCalledWith('/vault/assets/icons/demo.png');
    expect(mocked.loadAppIconImageSrc).not.toHaveBeenCalled();
  });

  it('does not load an empty path when a relative note icon cannot be resolved', async () => {
    mocked.resolveExistingVaultAssetPath.mockResolvedValue('');

    render(<NoteIcon icon="img:assets/icons/missing.png" notePath="/vault/demo.md" size={20} />);

    await waitFor(() => {
      expect(mocked.resolveExistingVaultAssetPath).toHaveBeenCalled();
    });

    expect(mocked.loadImageAsBlob).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: 'icon' })).not.toBeInTheDocument();
  });
});
