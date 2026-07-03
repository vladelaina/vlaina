import { cn } from '@/lib/utils';
import { isVerticalNotesSplit, type NotesSplitDirection } from './notesSplitLayout';

function getDropOverlayClass(direction: NotesSplitDirection): string {
  switch (direction) {
    case 'left':
      return 'bottom-[var(--vlaina-space-12px)] left-[var(--vlaina-space-12px)] top-[var(--vlaina-space-12px)] w-[calc(50%_-_var(--vlaina-space-18px))]';
    case 'right':
      return 'bottom-[var(--vlaina-space-12px)] right-[var(--vlaina-space-12px)] top-[var(--vlaina-space-12px)] w-[calc(50%_-_var(--vlaina-space-18px))]';
    case 'top':
      return 'left-[var(--vlaina-space-12px)] right-[var(--vlaina-space-12px)] top-[var(--vlaina-space-12px)] h-[calc(50%_-_var(--vlaina-space-18px))]';
    case 'bottom':
      return 'bottom-[var(--vlaina-space-12px)] left-[var(--vlaina-space-12px)] right-[var(--vlaina-space-12px)] h-[calc(50%_-_var(--vlaina-space-18px))]';
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
          'absolute rounded-[var(--vlaina-radius-8px)] bg-[var(--vlaina-color-accent-panel-bg)] shadow-[inset_0_0_0_1px_var(--vlaina-color-sidebar-focus-ring)]',
          isVerticalNotesSplit(direction) ? 'min-w-[var(--vlaina-size-120px)]' : 'min-h-[var(--vlaina-size-120px)]',
          getDropOverlayClass(direction)
        )}
      />
    </div>
  );
}
