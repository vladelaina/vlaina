import { renderHook } from '@testing-library/react';
import { useRef, type Dispatch, type SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeWhiteboardSnapshot } from '../model/whiteboardDocument';
import { useWhiteboardStorageBridge } from './useWhiteboardStorageBridge';

const mocks = vi.hoisted(() => ({
  notesRootPath: '/notes-a',
  whiteboardState: {
    activeBoardId: 'default' as string | null,
    activeSnapshot: null as ReturnType<typeof normalizeWhiteboardSnapshot> | null,
    loadedNotesRootPath: '/notes-a' as string | null,
    loadForNotesRoot: vi.fn(async () => undefined),
  },
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector: (state: { currentNotesRoot: { path: string } }) => unknown) => selector({
    currentNotesRoot: { path: mocks.notesRootPath },
  }),
}));

vi.mock('../stores/useWhiteboardStore', () => ({
  useWhiteboardStore: (selector: (state: typeof mocks.whiteboardState) => unknown) => selector(mocks.whiteboardState),
}));

describe('useWhiteboardStorageBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notesRootPath = '/notes-a';
    mocks.whiteboardState.loadedNotesRootPath = '/notes-a';
    mocks.whiteboardState.activeSnapshot = createSnapshot('image-a');
  });

  it('applies the same board id again after the storage root changes', () => {
    const setElements = vi.fn<(value: SetStateAction<ReturnType<typeof createSnapshot>['elements']>) => void>();
    const { rerender } = renderHook(() => useBridgeHarness(setElements));
    expect(setElements).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'image-a' })]));

    mocks.notesRootPath = '/notes-b';
    rerender();
    expect(setElements).toHaveBeenCalledTimes(1);

    mocks.whiteboardState.loadedNotesRootPath = '/notes-b';
    mocks.whiteboardState.activeSnapshot = createSnapshot('image-b');
    rerender();

    expect(setElements).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'image-b' })]));
  });
});

function useBridgeHarness(setElements: Dispatch<SetStateAction<ReturnType<typeof createSnapshot>['elements']>>) {
  const appliedBoardKeyRef = useRef<string | null>(null);
  const strokeIdRef = useRef(1);
  useWhiteboardStorageBridge({
    active: true,
    appliedBoardKeyRef,
    setElements,
    setPaper: vi.fn(),
    setSelectedElementIds: vi.fn(),
    setSelectedStrokeIds: vi.fn(),
    setStrokes: vi.fn(),
    setViewport: vi.fn(),
    strokeIdRef,
  });
}

function createSnapshot(id: string) {
  return normalizeWhiteboardSnapshot({
    elements: [{ height: 80, id, text: '', type: 'image', width: 100, x: 0, y: 0 }],
  });
}
