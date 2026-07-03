import type { NotesSplitDirection } from './notesSplitLayout';

export function getNotesSplitPaneBorderClass(direction: NotesSplitDirection): string {
  switch (direction) {
    case 'left':
      return 'border-r';
    case 'right':
      return 'border-l';
    case 'top':
      return 'border-b';
    case 'bottom':
      return 'border-t';
  }
}
