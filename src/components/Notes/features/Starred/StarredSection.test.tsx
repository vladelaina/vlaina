import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StarredSection } from './StarredSection';

const mocked = vi.hoisted(() => ({
  requestFileTreePointerDragDropTargetUpdate: vi.fn(),
  dragSnapshot: {
    activeSourcePath: null as string | null,
    dropTargetPath: null as string | null,
    dropTargetKind: null as 'folder' | 'starred' | null,
  },
  externalDropSnapshot: {
    active: false,
    dropTargetPath: null as string | null,
    dropTargetKind: null as 'folder' | 'starred' | null,
  },
  starredState: {
    starredLoaded: true,
    hasEntries: false,
    entries: [],
  },
}));

vi.mock('../FileTree/hooks/fileTreePointerDragState', () => ({
  requestFileTreePointerDragDropTargetUpdate: mocked.requestFileTreePointerDragDropTargetUpdate,
  useFileTreePointerDragState: (selector: (snapshot: typeof mocked.dragSnapshot) => unknown) =>
    selector(mocked.dragSnapshot),
}));

vi.mock('../FileTree/hooks/externalFileTreeDropState', () => ({
  useExternalFileTreeDropState: (selector: (snapshot: typeof mocked.externalDropSnapshot) => unknown) =>
    selector(mocked.externalDropSnapshot),
}));

vi.mock('./useStarredSectionEntries', () => ({
  useStarredSectionEntries: () => mocked.starredState,
}));

describe('StarredSection', () => {
  beforeEach(() => {
    mocked.dragSnapshot.activeSourcePath = null;
    mocked.dragSnapshot.dropTargetPath = null;
    mocked.dragSnapshot.dropTargetKind = null;
    mocked.externalDropSnapshot.active = false;
    mocked.externalDropSnapshot.dropTargetPath = null;
    mocked.externalDropSnapshot.dropTargetKind = null;
    mocked.requestFileTreePointerDragDropTargetUpdate.mockClear();
    mocked.starredState.starredLoaded = true;
    mocked.starredState.hasEntries = false;
    mocked.starredState.entries = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('reserves embedded sidebar space when empty and no file tree item is being dragged', () => {
    const { container } = render(<StarredSection showTitle={false} />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText('Starred')).toBeNull();
  });

  it('stays hidden in titled sections when empty and no file tree item is being dragged', () => {
    const { container } = render(<StarredSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders an empty starred drop target while a file tree item is being dragged', () => {
    mocked.dragSnapshot.activeSourcePath = 'Source.md';

    const { container } = render(<StarredSection showTitle={false} />);

    expect(screen.getAllByText('Starred').length).toBeGreaterThan(0);
    const target = container.querySelector('[data-file-tree-starred-drop-target="true"]');
    expect(target).not.toBeNull();
    expect(target?.className).not.toContain('absolute');
  });

  it('opens the empty starred section while a file tree item is being dragged', () => {
    mocked.dragSnapshot.activeSourcePath = 'Source.md';

    const { container } = render(<StarredSection />);

    const contentGrid = container.querySelector('[class*="grid-rows-"]');
    expect(contentGrid?.className).toContain('grid-rows-[1fr]');
    expect(mocked.requestFileTreePointerDragDropTargetUpdate).toHaveBeenCalledTimes(1);
  });

  it('renders and opens the empty starred section during an external file drag', () => {
    mocked.externalDropSnapshot.active = true;

    const { container } = render(<StarredSection />);

    expect(screen.getAllByText('Starred').length).toBeGreaterThan(0);
    const contentGrid = container.querySelector('[class*="grid-rows-"]');
    expect(contentGrid?.className).toContain('grid-rows-[1fr]');
    expect(mocked.requestFileTreePointerDragDropTargetUpdate).not.toHaveBeenCalled();
  });
});
