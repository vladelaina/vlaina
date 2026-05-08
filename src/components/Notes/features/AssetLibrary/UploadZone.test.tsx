import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadZone } from './UploadZone';

const mocks = vi.hoisted(() => ({
  uploadAsset: vi.fn(),
  uploadProgress: null as number | null,
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: {
    uploadAsset: typeof mocks.uploadAsset;
    uploadProgress: number | null;
  }) => unknown) =>
    selector({
      uploadAsset: mocks.uploadAsset,
      uploadProgress: mocks.uploadProgress,
    }),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

describe('UploadZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadProgress = null;
  });

  it('leaves uploading state when the cover upload fails unexpectedly', async () => {
    mocks.uploadAsset.mockRejectedValue(new Error('Disk write failed'));

    render(
      <UploadZone
        onUploadComplete={vi.fn()}
        currentNotePath="note.md"
        compact
      />,
    );

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(['cover'], 'cover.png', { type: 'image/png' });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(await screen.findByText('Uploading...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Disk write failed')).toBeInTheDocument();
    });
  });

  it('completes the upload callback even if the zone unmounts during upload', async () => {
    let resolveUpload: (value: {
      success: true;
      path: string;
      isDuplicate: false;
    }) => void = () => {};
    mocks.uploadAsset.mockReturnValue(new Promise((resolve) => {
      resolveUpload = resolve;
    }));
    const onUploadComplete = vi.fn();

    const view = render(
      <UploadZone
        onUploadComplete={onUploadComplete}
        currentNotePath="note.md"
        compact
      />,
    );

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(['cover'], 'cover.png', { type: 'image/png' });
    fireEvent.change(input!, { target: { files: [file] } });
    view.unmount();

    resolveUpload({
      success: true,
      path: './assets/cover.png',
      isDuplicate: false,
    });

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith('./assets/cover.png');
    });
  });
});
