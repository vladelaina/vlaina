import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssetGrid } from './AssetGrid';

let virtualRowsLimit: number | null = null;
const measureMock = vi.fn();
const mockGridRef = { current: null as HTMLDivElement | null };
const getAssetListMock = vi.fn();
const loadAssetsMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: virtualRowsLimit ?? count }, (_, index) => ({
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
  }) => unknown) =>
    selector({
      getAssetList: getAssetListMock,
      loadAssets: loadAssetsMock,
    }),
}));

vi.mock('./hooks/useAssetHover', () => ({
  useAssetHover: () => ({
    hoveredFilename: 'cover-a.png',
    gridRef: mockGridRef,
  }),
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

describe('AssetGrid', () => {
  beforeEach(() => {
    measureMock.mockClear();
    getAssetListMock.mockReset();
    loadAssetsMock.mockReset();
    mockGridRef.current = null;
    virtualRowsLimit = null;
  });

  it('renders selectable items from the loaded asset list', () => {
    getAssetListMock.mockReturnValue([
      { filename: 'cover-a.png', size: 10 },
      { filename: 'cover-b.png', size: 20 },
    ]);

    const onSelect = vi.fn();

    render(
      <AssetGrid
        onSelect={onSelect}
        onHover={() => {}}
        notesRootPath="/notesRoot"
      />,
    );

    expect(loadAssetsMock).not.toHaveBeenCalled();
    expect(screen.getByText('cover-a.png')).toBeInTheDocument();
    expect(screen.getByText('cover-a.png')).toHaveAttribute('data-hovered', 'true');
    expect(measureMock).toHaveBeenCalled();

    fireEvent.click(screen.getByText('cover-b.png'));
    expect(onSelect).toHaveBeenCalledWith('cover-b.png');
  });

  it('does not render per-cover delete controls', () => {
    getAssetListMock.mockReturnValue([
      { filename: 'cover-a.png', size: 10 },
    ]);

    render(
      <AssetGrid
        onSelect={() => {}}
        onHover={() => {}}
        notesRootPath="/notesRoot"
      />,
    );

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders nothing when there are no assets', () => {
    getAssetListMock.mockReturnValue([]);

    const { container } = render(
      <AssetGrid
        onSelect={() => {}}
        onHover={() => {}}
        notesRootPath="/notesRoot"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('only renders virtualized visible rows for large asset lists', () => {
    virtualRowsLimit = 2;
    getAssetListMock.mockReturnValue(
      Array.from({ length: 1000 }, (_, index) => ({
        filename: `cover-${index}.png`,
        size: index,
      })),
    );

    render(
      <AssetGrid
        onSelect={() => {}}
        onHover={() => {}}
        notesRootPath="/notesRoot"
      />,
    );

    expect(screen.getByText('cover-0.png')).toBeInTheDocument();
    expect(screen.queryByText('cover-999.png')).not.toBeInTheDocument();
  });
});
