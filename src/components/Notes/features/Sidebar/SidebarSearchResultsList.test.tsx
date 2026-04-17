import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { SidebarSearchResultsList } from './SidebarSearchResultsList';
import type { NotesSidebarSearchResult } from './notesSidebarSearchResults';

const measureMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: (index: number) => number }) => ({
    getTotalSize: () =>
      Array.from({ length: count }, (_, index) => estimateSize(index)).reduce((sum, size) => sum + size, 0),
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: estimateSize(index),
        start: Array.from({ length: index }, (_, innerIndex) => estimateSize(innerIndex)).reduce((sum, size) => sum + size, 0),
      })),
    measure: measureMock,
  }),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => null,
}));

vi.mock('../IconPicker/NoteIcon', () => ({
  NoteIcon: () => <span data-testid="note-icon" />,
}));

vi.mock('./NotesSidebarRow', () => ({
  NotesSidebarRow: ({
    main,
    isActive,
    onClick,
  }: {
    main: ReactNode;
    isActive?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" data-active={isActive ? 'true' : 'false'} onClick={onClick}>
      {main}
    </button>
  ),
}));

function buildResult(overrides: Partial<NotesSidebarSearchResult> = {}): NotesSidebarSearchResult {
  return {
    id: 'result-1',
    path: 'folder/alpha.md',
    name: 'Alpha Note',
    preview: 'folder/',
    matchIndex: 0,
    matchKind: 'name',
    contentSnippet: null,
    contentMatchOrdinal: null,
    ...overrides,
  };
}

describe('SidebarSearchResultsList', () => {
  beforeEach(() => {
    measureMock.mockClear();
  });

  it('renders results and opens the clicked item', () => {
    const onOpen = vi.fn();
    const scrollRootRef = createRef<HTMLDivElement>();

    render(
      <SidebarSearchResultsList
        results={[
          buildResult(),
          buildResult({
            id: 'result-2',
            path: 'folder/beta.md',
            name: 'Beta Note',
            preview: 'folder/',
            contentSnippet: 'Contains the search phrase.',
            matchKind: 'content',
            contentMatchOrdinal: 0,
          }),
        ]}
        query="search"
        currentNotePath="folder/alpha.md"
        onOpen={onOpen}
        scrollRootRef={scrollRootRef}
        isContentScanPending={false}
      />,
    );

    expect(screen.getByText('Alpha Note')).toBeInTheDocument();
    const betaRow = screen.getByText('Beta Note').closest('button');
    expect(betaRow).not.toBeNull();
    expect(betaRow).toHaveTextContent('Contains the search phrase.');
    expect(measureMock).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Beta Note'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'result-2',
        path: 'folder/beta.md',
      }),
    );
  });

  it('resets scroll position when the deferred query changes', () => {
    const scrollRoot = document.createElement('div');
    const scrollToMock = vi.fn();
    scrollRoot.scrollTo = scrollToMock;
    const scrollRootRef = createRef<HTMLDivElement>();
    scrollRootRef.current = scrollRoot;

    const { rerender } = render(
      <SidebarSearchResultsList
        results={[buildResult()]}
        query=""
        currentNotePath={null}
        onOpen={() => {}}
        scrollRootRef={scrollRootRef}
        isContentScanPending={false}
      />,
    );

    scrollToMock.mockClear();

    rerender(
      <SidebarSearchResultsList
        results={[buildResult()]}
        query="alpha"
        currentNotePath={null}
        onOpen={() => {}}
        scrollRootRef={scrollRootRef}
        isContentScanPending={false}
      />,
    );

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('keeps the pending label visible while content scanning is running', () => {
    render(
      <SidebarSearchResultsList
        results={[]}
        query="al"
        currentNotePath={null}
        onOpen={() => {}}
        scrollRootRef={createRef<HTMLDivElement>()}
        isContentScanPending
      />,
    );

    expect(screen.getByText('Searching note contents...')).toBeInTheDocument();
  });
});
