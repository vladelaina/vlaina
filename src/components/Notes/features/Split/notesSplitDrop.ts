import type { NotesSplitDirection, NotesSplitRect } from './notesSplitTypes';

const SPLIT_EDGE_THRESHOLD = 0.28;

export function resolveNotesSplitDropDirection(
  rect: NotesSplitRect,
  point: { clientX: number; clientY: number }
): NotesSplitDirection | null {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    point.clientX < rect.left ||
    point.clientX > rect.right ||
    point.clientY < rect.top ||
    point.clientY > rect.bottom
  ) {
    return null;
  }

  const candidates: Array<{ direction: NotesSplitDirection; distance: number }> = [
    { direction: 'left', distance: (point.clientX - rect.left) / rect.width },
    { direction: 'right', distance: (rect.right - point.clientX) / rect.width },
    { direction: 'top', distance: (point.clientY - rect.top) / rect.height },
    { direction: 'bottom', distance: (rect.bottom - point.clientY) / rect.height },
  ];
  const nearest = candidates.reduce((best, candidate) => (
    candidate.distance < best.distance ? candidate : best
  ));

  return nearest.distance <= SPLIT_EDGE_THRESHOLD ? nearest.direction : null;
}
