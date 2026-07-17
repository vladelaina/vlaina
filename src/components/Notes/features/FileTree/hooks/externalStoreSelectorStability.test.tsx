import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getFileTreePointerDragSnapshot,
  setFileTreePointerDragSnapshot,
  useFileTreePointerDragState,
} from './fileTreePointerDragStore';
import {
  clearExternalFileTreeDropTarget,
  setExternalFileTreeDropTarget,
  useExternalFileTreeDropState,
} from './externalFileTreeDropState';

function SelectorHarness() {
  const pointerDrag = useFileTreePointerDragState((snapshot) => ({
    active: snapshot.activeSourcePath !== null,
  }));
  const externalDrop = useExternalFileTreeDropState((snapshot) => ({
    active: snapshot.active,
  }));

  return <div>{String(pointerDrag.active)}:{String(externalDrop.active)}</div>;
}

describe('external file tree selector hooks', () => {
  afterEach(() => {
    act(() => {
      setFileTreePointerDragSnapshot({
        activeSourcePath: null,
        dropTargetKind: null,
        dropTargetPath: null,
      });
      clearExternalFileTreeDropTarget();
    });
  });

  it('allows derived object selectors without exposing them as external-store snapshots', () => {
    expect(getFileTreePointerDragSnapshot().activeSourcePath).toBeNull();
    render(
      <StrictMode>
        <SelectorHarness />
      </StrictMode>,
    );

    expect(screen.getByText('false:false')).toBeInTheDocument();

    act(() => {
      setFileTreePointerDragSnapshot({
        activeSourcePath: 'docs/alpha.md',
        dropTargetKind: null,
        dropTargetPath: null,
      });
      setExternalFileTreeDropTarget('docs', 'folder');
    });

    expect(screen.getByText('true:true')).toBeInTheDocument();
  });
});
