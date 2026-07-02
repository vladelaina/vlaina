import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoverPicker } from './CoverPicker';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

const hoisted = vi.hoisted(() => ({
  loadAssets: vi.fn(),
  uploadAsset: vi.fn(),
  assetList: [] as Array<{ filename: string }>,
  isLoadingAssets: false,
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    assetList: hoisted.assetList,
    isLoadingAssets: hoisted.isLoadingAssets,
    loadAssets: hoisted.loadAssets,
    uploadAsset: hoisted.uploadAsset,
  }),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ open, children }: { open: boolean; children?: ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
  PopoverAnchor: ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  PopoverContent: ({
    children,
    align: _align,
    side: _side,
    sideOffset: _sideOffset,
    ...props
  }: {
    children?: ReactNode;
    align?: string;
    side?: string;
    sideOffset?: number;
  }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('./AssetGrid', () => ({
  AssetGrid: ({ onHover }: { onHover?: (assetPath: string | null) => void }) => (
    <div data-testid="asset-grid">
      <button type="button" onMouseEnter={() => onHover?.('a.png')}>
        hover a
      </button>
      <button type="button" onMouseEnter={() => onHover?.('b.png')}>
        hover b
      </button>
    </div>
  ),
}));

vi.mock('./UploadZone', () => ({
  UploadZone: () => <div data-testid="upload-zone" />,
}));

vi.mock('./EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

describe('CoverPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.loadAssets.mockReturnValue(new Promise(() => undefined));
    hoisted.assetList = [];
    hoisted.isLoadingAssets = false;
  });

  it('uses the shared composer pill surface for the picker shell', () => {
    const { container } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="note.md"
      />,
    );

    const pickerShell = Array.from(container.querySelectorAll('div'))
      .find((element) => element.className.includes('w-[var(--vlaina-size-340px)]'));
    expect(pickerShell?.className).toContain(chatComposerPillSurfaceClass);
    expect(pickerShell?.className).toContain('!rounded-[var(--vlaina-radius-26px)]');
    expect(pickerShell?.getAttribute('data-no-editor-drag-box')).toBe('true');
  });

  it('removes the current cover without bubbling pointer events to cover interactions', () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();
    const onPreview = vi.fn();
    const parentPointerDown = vi.fn();
    const parentMouseDown = vi.fn();

    render(
      <div onPointerDown={parentPointerDown} onMouseDown={parentMouseDown}>
        <CoverPicker
          isOpen
          onClose={onClose}
          onSelect={vi.fn()}
          onRemove={onRemove}
          onPreview={onPreview}
          notesRootPath="/notesRoot"
          currentNotePath="note.md"
        />
      </div>,
    );

    const removeButton = screen.getByRole('button', { name: 'Remove' });
    fireEvent.pointerDown(removeButton);
    fireEvent.mouseDown(removeButton);
    fireEvent.click(removeButton);

    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(parentMouseDown).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledWith(null);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('debounces cover previews while moving across library items', async () => {
    hoisted.loadAssets.mockResolvedValue(undefined);
    hoisted.assetList = [{ filename: 'a.png' }];
    const onPreview = vi.fn();

    render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onPreview={onPreview}
        notesRootPath="/notesRoot"
        currentNotePath="note.md"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('asset-grid')).toBeInTheDocument());

    vi.useFakeTimers();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'hover a' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'hover b' }));
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith('b.png');
    vi.useRealTimers();
  });

  it('starts asset reload when the picker opens and uses the latest note scope', async () => {
    hoisted.assetList = [{ filename: 'a.png' }];

    const { rerender } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    await waitFor(() => expect(hoisted.loadAssets).toHaveBeenCalledTimes(1));

    rerender(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="nested/two.md"
      />,
    );

    await waitFor(() => expect(hoisted.loadAssets).toHaveBeenCalledTimes(2));
    expect(hoisted.loadAssets).toHaveBeenLastCalledWith('/notesRoot');
  });

  it('shows a stable loading state instead of stale assets while the library refreshes', async () => {
    let resolveLoad: () => void = () => {};
    hoisted.assetList = [{ filename: 'stale-single-cover.png' }];
    hoisted.loadAssets.mockReturnValue(new Promise<void>((resolve) => {
      resolveLoad = resolve;
    }));

    render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    expect(screen.getByTestId('asset-library-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('asset-grid')).not.toBeInTheDocument();

    await waitFor(() => expect(hoisted.loadAssets).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveLoad();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId('asset-grid')).toBeInTheDocument());
  });

  it('does not refetch only because the asset count changes while open', async () => {
    hoisted.loadAssets.mockResolvedValue(undefined);
    hoisted.assetList = [];
    const { rerender } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    await waitFor(() => expect(hoisted.loadAssets).toHaveBeenCalledTimes(1));

    hoisted.assetList = [{ filename: 'a.png' }];
    rerender(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('asset-grid')).toBeInTheDocument());
    expect(hoisted.loadAssets).toHaveBeenCalledTimes(1);
  });

  it('does not enter library loading when opened without a opened folder path', () => {
    hoisted.assetList = [];

    render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath=""
        currentNotePath="one.md"
      />,
    );

    expect(hoisted.loadAssets).not.toHaveBeenCalled();
    expect(screen.queryByTestId('asset-library-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('upload-zone')).toBeInTheDocument();
  });

  it('does not show paste instructions in the upload tab', () => {
    hoisted.assetList = [{ filename: 'a.png' }];

    render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Upload/ }));

    expect(screen.getByTestId('upload-zone')).toBeInTheDocument();
    expect(screen.queryByText(/to paste/i)).not.toBeInTheDocument();
  });

  it('keeps the library header controls when cover images exist', () => {
    hoisted.assetList = [{ filename: 'a.png' }];

    const { container } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    expect(screen.getByRole('button', { name: /Library/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
    expect(container.querySelector('.border-b')).toBeInTheDocument();
  });

  it('keeps the header controls when editing an existing cover even if the library is empty', async () => {
    hoisted.loadAssets.mockResolvedValue(undefined);
    hoisted.assetList = [];

    const { container } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    expect(screen.getByRole('button', { name: /Library/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
    expect(container.querySelector('.border-b')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('upload-zone')).toBeInTheDocument());
  });

  it('shows upload inside library when there are no cover images', async () => {
    hoisted.loadAssets.mockResolvedValue(undefined);
    hoisted.assetList = [];

    render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('upload-zone')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Library/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('hides tabs and the divider while showing empty-library upload', async () => {
    hoisted.loadAssets.mockResolvedValue(undefined);
    hoisted.assetList = [];

    const { container } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        notesRootPath="/notesRoot"
        currentNotePath="one.md"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('upload-zone')).toBeInTheDocument());
    expect(container.querySelector('.border-b')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Library/ })).not.toBeInTheDocument();
  });
});
