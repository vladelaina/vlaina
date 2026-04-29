import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StarredSection } from './StarredSection';

const mocked = vi.hoisted(() => ({
  dragSnapshot: {
    activeSourcePath: null as string | null,
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
  useFileTreePointerDragState: (selector: (snapshot: typeof mocked.dragSnapshot) => unknown) =>
    selector(mocked.dragSnapshot),
}));

vi.mock('./useStarredSectionEntries', () => ({
  useStarredSectionEntries: () => mocked.starredState,
}));

describe('StarredSection', () => {
  beforeEach(() => {
    mocked.dragSnapshot.activeSourcePath = null;
    mocked.dragSnapshot.dropTargetPath = null;
    mocked.dragSnapshot.dropTargetKind = null;
    mocked.starredState.starredLoaded = true;
    mocked.starredState.hasEntries = false;
    mocked.starredState.entries = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('stays hidden when empty and no file tree item is being dragged', () => {
    const { container } = render(<StarredSection showTitle={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders an empty starred drop target while a file tree item is being dragged', () => {
    mocked.dragSnapshot.activeSourcePath = 'Source.md';

    render(<StarredSection showTitle={false} />);

    expect(screen.getByText('Starred')).toBeInTheDocument();
    expect(document.querySelector('[data-file-tree-starred-drop-target="true"]')).not.toBeNull();
  });
});
