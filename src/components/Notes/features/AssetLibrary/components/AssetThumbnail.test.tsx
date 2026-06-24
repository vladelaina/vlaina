import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetThumbnail } from './AssetThumbnail';

const hoisted = vi.hoisted(() => ({
  loadImageThumbnailAsBlob: vi.fn(),
  resolveVaultAssetPath: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageThumbnailAsBlob: hoisted.loadImageThumbnailAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveVaultAssetPath: hoisted.resolveVaultAssetPath,
}));

type PendingThumbnailLoad = {
  path: string;
  resolve: (value: string) => void;
};

function renderThumbnail(filename: string, loadPriority: number) {
  return (
    <AssetThumbnail
      key={filename}
      filename={filename}
      size={10}
      vaultPath="/vault"
      currentNotePath="note.md"
      onSelect={() => {}}
      isHovered={false}
      compact
      loadPriority={loadPriority}
    />
  );
}

describe('AssetThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.resolveVaultAssetPath.mockImplementation(
      async (_vaultPath: string, filename: string) => `/vault/assets/${filename}`,
    );
  });

  it('loads visible thumbnails with a bounded four-request concurrency', async () => {
    const pendingLoads: PendingThumbnailLoad[] = [];
    hoisted.loadImageThumbnailAsBlob.mockImplementation((path: string) => new Promise<string>((resolve) => {
      pendingLoads.push({ path, resolve });
    }));

    render(
      <>
        {Array.from({ length: 5 }, (_value, index) =>
          renderThumbnail(`cover-${index}.png`, index)
        )}
      </>,
    );

    await waitFor(() => expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(4));
    expect(pendingLoads.map((load) => load.path)).toEqual([
      '/vault/assets/cover-0.png',
      '/vault/assets/cover-1.png',
      '/vault/assets/cover-2.png',
      '/vault/assets/cover-3.png',
    ]);

    await act(async () => {
      pendingLoads[0]!.resolve('blob:cover-0');
      await Promise.resolve();
    });

    await waitFor(() => expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(5));
    expect(pendingLoads[4]?.path).toBe('/vault/assets/cover-4.png');

    await act(async () => {
      pendingLoads.slice(1).forEach((load, index) => load.resolve(`blob:cover-${index + 1}`));
      await Promise.resolve();
    });
  });
});
