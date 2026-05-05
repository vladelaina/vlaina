import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoverPicker } from './CoverPicker';

const hoisted = vi.hoisted(() => ({
  loadAssets: vi.fn(),
  uploadAsset: vi.fn(),
  assetList: [],
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
  AssetGrid: () => <div data-testid="asset-grid" />,
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
});
