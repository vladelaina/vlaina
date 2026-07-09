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
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className} />
  ),
}));

const supportedImageFilenames = [
  'photo.jpg',
  'photo.jpeg',
  'screenshot.png',
  'animation.gif',
  'cover.webp',
  'diagram.svg',
  'scan.bmp',
  'favicon.ico',
  'photo.avif',
];

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

  it('rejects image files with invalid size metadata before uploading', async () => {
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
    Object.defineProperty(file, 'size', {
      configurable: true,
      value: Number.NaN,
    });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(await screen.findByText('File exceeds maximum size of 50MB')).toBeInTheDocument();
    expect(mocks.uploadAsset).not.toHaveBeenCalled();
  });

  it.each(supportedImageFilenames)('accepts %s when the browser does not provide a MIME type', async (filename) => {
    mocks.uploadAsset.mockResolvedValue({
      success: true,
      path: `./assets/${filename}`,
      isDuplicate: false,
    });
    const onUploadComplete = vi.fn();
    render(
      <UploadZone
        onUploadComplete={onUploadComplete}
        currentNotePath="note.md"
        compact
      />,
    );

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(['cover'], filename);
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(mocks.uploadAsset).toHaveBeenCalledWith(file, 'note.md');
    });
    expect(onUploadComplete).toHaveBeenCalledWith(`./assets/${filename}`);
  });

  it('keeps compact idle upload zones icon-only with themed border styling', () => {
    const { container } = render(
      <UploadZone
        onUploadComplete={vi.fn()}
        currentNotePath="note.md"
        compact
      />,
    );

    expect(screen.queryByText('Drop or click to upload')).not.toBeInTheDocument();
    expect(screen.getByTestId('icon-common.upload')).toHaveClass('text-[var(--vlaina-accent)]');
    expect(container.firstElementChild).toHaveClass('border-[var(--vlaina-color-accent-border-muted)]');
    expect(container.firstElementChild).toHaveClass('bg-[var(--vlaina-color-accent-muted-bg)]');
  });

  it('opens the native image picker when clicked', () => {
    const originalShowPicker = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'showPicker');
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    try {
      render(
        <UploadZone
          onUploadComplete={vi.fn()}
          currentNotePath="note.md"
          compact
        />,
      );

      fireEvent.click(screen.getByTestId('icon-common.upload').parentElement!);

      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      if (originalShowPicker) {
        Object.defineProperty(HTMLInputElement.prototype, 'showPicker', originalShowPicker);
      } else {
        Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
      }
    }
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
