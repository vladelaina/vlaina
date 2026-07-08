import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { SidebarSearchResultsList } from './SidebarSearchResultsList';
import type { NotesSidebarSearchResult } from './notesSidebarSearchResults';

const measureMock = vi.fn();
const scrollToIndexMock = vi.fn();

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
    scrollToIndex: scrollToIndexMock,
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
    isHighlighted,
    onClick,
  }: {
    main: ReactNode;
    isActive?: boolean;
    isHighlighted?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      data-active={isActive ? 'true' : 'false'}
      data-highlighted={isHighlighted ? 'true' : 'false'}
      onClick={onClick}
    >
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
    scrollToIndexMock.mockClear();
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
    const snippet = Array.from(betaRow?.querySelectorAll('div') ?? [])
      .find((element) => element.textContent === 'Contains the search phrase.');
    expect(betaRow).not.toBeNull();
    expect(betaRow).toHaveTextContent('Contains the search phrase.');
    expect(snippet).toHaveClass('text-[var(--vlaina-font-11)]');
    expect(snippet).toHaveClass('leading-[var(--vlaina-leading-145)]');
    expect(measureMock).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Beta Note'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'result-2',
        path: 'folder/beta.md',
      }),
    );
  });

  it('wraps long result names and locations instead of truncating them', () => {
    const longName = 'alpha-super-long-note-title-without-natural-breakpoints.md';
    const longLocation = 'deeply/nested/folder/name/without/easy/breakpoints/';

    render(
      <SidebarSearchResultsList
        results={[
          buildResult({
            id: 'long-result',
            path: `${longLocation}${longName}`,
            name: longName,
            preview: longLocation,
          }),
        ]}
        query="alpha"
        currentNotePath={null}
        onOpen={() => {}}
        scrollRootRef={createRef<HTMLDivElement>()}
        isContentScanPending={false}
      />,
    );

    const row = screen.getByRole('button');
    const textBlocks = Array.from(row.querySelectorAll('div'));
    const name = textBlocks.find((element) => element.textContent === longName);
    const locationText = longLocation.replace(/\/$/, '');
    const location = textBlocks.find((element) => element.textContent === locationText);

    expect(name).toHaveClass('whitespace-normal');
    expect(name).toHaveClass('break-words');
    expect(name).toHaveClass('[overflow-wrap:anywhere]');
    expect(name).not.toHaveClass('truncate');
    expect(location).toHaveClass('whitespace-normal');
    expect(location).toHaveClass('break-words');
    expect(location).toHaveClass('leading-[var(--vlaina-leading-145)]');
    expect(location).toHaveClass('[overflow-wrap:anywhere]');
    expect(location).not.toHaveClass('truncate');
  });

  it('only marks the clicked match active when one file has multiple results', () => {
    render(
      <SidebarSearchResultsList
        results={[
          buildResult({
            id: 'folder/alpha.md::content::0',
            matchKind: 'content',
            contentSnippet: 'First alpha match.',
            contentMatchOrdinal: 0,
          }),
          buildResult({
            id: 'folder/alpha.md::content::1',
            matchKind: 'content',
            contentSnippet: 'Second alpha match.',
            contentMatchOrdinal: 1,
          }),
        ]}
        query="alpha"
        currentNotePath="folder/alpha.md"
        activeResultId="folder/alpha.md::content::1"
        onOpen={() => {}}
        scrollRootRef={createRef<HTMLDivElement>()}
        isContentScanPending={false}
      />,
    );

    const rows = screen.getAllByRole('button');
    const firstRow = rows.find((row) => row.textContent?.includes('First alpha match.'));
    const secondRow = rows.find((row) => row.textContent?.includes('Second alpha match.'));

    expect(firstRow).toHaveAttribute(
      'data-active',
      'false',
    );
    expect(secondRow).toHaveAttribute(
      'data-active',
      'true',
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

  it('highlights and scrolls the keyboard-selected result into view', () => {
    render(
      <SidebarSearchResultsList
        results={[
          buildResult({ id: 'result-1', name: 'Alpha Note' }),
          buildResult({ id: 'result-2', path: 'folder/beta.md', name: 'Beta Note' }),
        ]}
        query="note"
        currentNotePath={null}
        highlightedResultId="result-2"
        onOpen={() => {}}
        scrollRootRef={createRef<HTMLDivElement>()}
        isContentScanPending={false}
      />,
    );

    const betaRow = screen
      .getAllByRole('button')
      .find((row) => row.textContent?.includes('Beta Note'));

    expect(betaRow).toHaveAttribute('data-highlighted', 'true');
    expect(scrollToIndexMock).toHaveBeenCalledWith(1, { align: 'auto' });
  });

  it('highlights matches after case folding expands earlier characters', () => {
    render(
      <SidebarSearchResultsList
        results={[
          buildResult({
            id: 'unicode-result',
            name: 'İstanbul Note',
          }),
        ]}
        query="note"
        currentNotePath={null}
        onOpen={() => {}}
        scrollRootRef={createRef<HTMLDivElement>()}
        isContentScanPending={false}
      />,
    );

    const highlighted = screen.getByText('Note');

    expect(highlighted).toHaveClass('text-[var(--vlaina-sidebar-row-selected-text)]');
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

  it('renders no empty result message after content scanning finishes', () => {
    render(
      <SidebarSearchResultsList
        results={[]}
        query="missing"
        currentNotePath={null}
        onOpen={() => {}}
        scrollRootRef={createRef<HTMLDivElement>()}
        isContentScanPending={false}
      />,
    );

    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });
});
