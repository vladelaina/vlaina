import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoverPicker } from './CoverPicker';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

const hoisted = vi.hoisted(() => ({
  loadAssets: vi.fn(),
  uploadAsset: vi.fn(),
  assetList: [] as Array<{ filename: string }>,
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    assetList: hoisted.assetList,
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
    hoisted.assetList = [];
  });

  it('uses the shared composer pill surface for the picker shell', () => {
    const { container } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        vaultPath="/vault"
        currentNotePath="note.md"
      />,
    );

    const pickerShell = Array.from(container.querySelectorAll('div'))
      .find((element) => element.className.includes('w-[340px]'));
    expect(pickerShell?.className).toContain(chatComposerPillSurfaceClass);
    expect(pickerShell?.className).toContain('!rounded-[26px]');
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
          vaultPath="/vault"
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

  it('debounces cover previews while moving across library items', () => {
    vi.useFakeTimers();
    hoisted.assetList = [{ filename: 'a.png' }];
    const onPreview = vi.fn();

    render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onPreview={onPreview}
        vaultPath="/vault"
        currentNotePath="note.md"
      />,
    );

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

  it('reloads assets when the current note changes while the picker is open', () => {
    hoisted.assetList = [{ filename: 'a.png' }];

    const { rerender } = render(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        vaultPath="/vault"
        currentNotePath="one.md"
      />,
    );

    rerender(
      <CoverPicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        vaultPath="/vault"
        currentNotePath="nested/two.md"
      />,
    );

    expect(hoisted.loadAssets).toHaveBeenCalledTimes(2);
    expect(hoisted.loadAssets).toHaveBeenNthCalledWith(1, '/vault');
    expect(hoisted.loadAssets).toHaveBeenNthCalledWith(2, '/vault');
  });
});
