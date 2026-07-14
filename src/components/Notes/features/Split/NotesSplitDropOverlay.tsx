import { cn } from '@/lib/utils';
import { isVerticalNotesSplit, type NotesSplitDirection } from './notesSplitLayout';

function getDropOverlayClass(direction: NotesSplitDirection): string {
  switch (direction) {
    case 'left':
      return 'bottom-[var(--vlaina-space-12px)] left-[var(--vlaina-space-12px)] top-[var(--vlaina-space-12px)] w-[var(--vlaina-size-split-drop-half)]';
    case 'right':
      return 'bottom-[var(--vlaina-space-12px)] right-[var(--vlaina-space-12px)] top-[var(--vlaina-space-12px)] w-[var(--vlaina-size-split-drop-half)]';
    case 'top':
      return 'left-[var(--vlaina-space-12px)] right-[var(--vlaina-space-12px)] top-[var(--vlaina-space-12px)] h-[var(--vlaina-size-split-drop-half)]';
    case 'bottom':
      return 'bottom-[var(--vlaina-space-12px)] left-[var(--vlaina-space-12px)] right-[var(--vlaina-space-12px)] h-[var(--vlaina-size-split-drop-half)]';
  }
}

export function NotesSplitDropOverlay({ direction }: { direction: NotesSplitDirection }) {
  return (
    <div
      aria-hidden="true"
      data-notes-split-drop-overlay={direction}
      className="pointer-events-none absolute inset-0 z-[var(--vlaina-z-30)]"
    >
      <div
        className={cn(
          'absolute rounded-[var(--vlaina-radius-8px)] bg-[var(--vlaina-color-editor-block-selection-drag-box)]',
          isVerticalNotesSplit(direction) ? 'min-w-[var(--vlaina-size-120px)]' : 'min-h-[var(--vlaina-size-120px)]',
          getDropOverlayClass(direction)
        )}
      />
    </div>
  );
}
