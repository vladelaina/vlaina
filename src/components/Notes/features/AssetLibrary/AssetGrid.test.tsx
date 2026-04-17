import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AssetGrid } from './AssetGrid';

const measureMock = vi.fn();
const mockGridRef = { current: null as HTMLDivElement | null };
const getAssetListMock = vi.fn();
const loadAssetsMock = vi.fn();
const deleteAssetMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: estimateSize(),
        start: index * estimateSize(),
      })),
    measure: measureMock,
  }),
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: {
    getAssetList: typeof getAssetListMock;
    loadAssets: typeof loadAssetsMock;
    deleteAsset: typeof deleteAssetMock;
  }) => unknown) =>
    selector({
      getAssetList: getAssetListMock,
      loadAssets: loadAssetsMock,
      deleteAsset: deleteAssetMock,
    }),
}));

vi.mock('./hooks/useAssetHover', () => ({
  useAssetHover: () => ({
    hoveredFilename: 'cover-a.png',
    gridRef: mockGridRef,
  }),
}));

vi.mock('@/components/ui/deletable-item', () => ({
  DeletableItem: ({
    id,
    onDelete,
    children,
  }: {
    id: string;
    onDelete?: (id: string) => void;
    children: ReactNode;
  }) => (
    <div>
      <button type="button" data-testid={`delete-${id}`} onClick={() => onDelete?.(id)}>
        delete
      </button>
      {children}
    </div>
  ),
}));

vi.mock('./components/AssetThumbnail', () => ({
  AssetThumbnail: ({
    filename,
    onSelect,
    isHovered,
  }: {
    filename: string;
    onSelect?: () => void;
    isHovered?: boolean;
  }) => (
    <button type="button" data-hovered={isHovered ? 'true' : 'false'} onClick={onSelect}>
      {filename}
    </button>
  ),
}));

vi.mock('@/lib/assets/builtinCovers', () => ({
  isBuiltinCover: () => false,
}));

describe('AssetGrid', () => {
  beforeEach(() => {
    measureMock.mockClear();
    getAssetListMock.mockReset();
    loadAssetsMock.mockReset();
    deleteAssetMock.mockReset();
    mockGridRef.current = null;
  });

  it('loads assets for the current vault and renders selectable items', () => {
    getAssetListMock.mockReturnValue([
      { filename: 'cover-a.png', size: 10 },
      { filename: 'cover-b.png', size: 20 },
    ]);

    const onSelect = vi.fn();

    render(
      <AssetGrid
        onSelect={onSelect}
        onHover={() => {}}
        vaultPath="/vault"
        category="covers"
      />,
    );

    expect(loadAssetsMock).toHaveBeenCalledWith('/vault');
    expect(screen.getByText('cover-a.png')).toBeInTheDocument();
    expect(screen.getByText('cover-a.png')).toHaveAttribute('data-hovered', 'true');
    expect(measureMock).toHaveBeenCalled();

    fireEvent.click(screen.getByText('cover-b.png'));
    expect(onSelect).toHaveBeenCalledWith('cover-b.png');
  });

  it('deletes the selected asset from the grid', () => {
    getAssetListMock.mockReturnValue([
      { filename: 'cover-a.png', size: 10 },
    ]);

    render(
      <AssetGrid
        onSelect={() => {}}
        onHover={() => {}}
        vaultPath="/vault"
        category="covers"
      />,
    );

    fireEvent.click(screen.getByTestId('delete-cover-a.png'));
    expect(deleteAssetMock).toHaveBeenCalledWith('cover-a.png');
  });

  it('renders nothing when there are no assets', () => {
    getAssetListMock.mockReturnValue([]);

    const { container } = render(
      <AssetGrid
        onSelect={() => {}}
        onHover={() => {}}
        vaultPath="/vault"
        category="covers"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
