import type { ReactNode } from 'react';
import {
  DragOverlay,
  defaultDropAnimation,
  type DropAnimation,
} from '@dnd-kit/core';

export const NOTES_DRAG_RETURN_ANIMATION = {
  duration: defaultDropAnimation.duration,
  easing: defaultDropAnimation.easing,
} as const;

export const NOTES_DRAG_DROP_ANIMATION: DropAnimation = {
  ...defaultDropAnimation,
  ...NOTES_DRAG_RETURN_ANIMATION,
};

interface NotesDragOverlayProps {
  children: ReactNode;
}

export function NotesDragOverlay({ children }: NotesDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={NOTES_DRAG_DROP_ANIMATION}>
      {children}
    </DragOverlay>
  );
}
