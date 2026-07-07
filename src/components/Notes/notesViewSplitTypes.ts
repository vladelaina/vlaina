import type { NotesSplitDirection, NotesSplitOrientation } from './features/Split/notesSplitLayout';

export type NotesSplitDropTarget = {
  leafId: string;
  direction: NotesSplitDirection;
};

export type ActiveNotesSplitResize = {
  splitId: string;
  orientation: NotesSplitOrientation;
  container: HTMLElement;
  previousBodyCursor: string;
  previousBodyUserSelect: string;
};

export type ActiveNotesSplitPaneDrag = {
  hasMoved: boolean;
  initialClientX: number;
  initialClientY: number;
  previousBodyCursor: string;
  previousBodyUserSelect: string;
  sourceLeafId: string;
};
