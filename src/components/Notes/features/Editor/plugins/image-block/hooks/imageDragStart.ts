import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Alignment } from '../types';
import { getPlaceholderMargin } from '../utils/imageDragPlaceholder';

export function markImageUserInput(view: EditorView): void {
    view.dom.dispatchEvent(new CustomEvent('editor:image-user-input', { bubbles: true }));
}

export function shouldIgnoreImageDragPointerDown(
    event: ReactPointerEvent,
    isActive: boolean,
    loadError: boolean,
): boolean {
    if (isActive || loadError) return true;
    if (!event.isPrimary || event.button !== 0) return true;

    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[data-resize-handle]')) {
        return true;
    }

    return event.ctrlKey || event.metaKey;
}

export function getImageDragSourceGeometry(container: HTMLDivElement | null) {
    const containerRect = container?.getBoundingClientRect();
    return {
        initialLeft: containerRect?.left || 0,
        initialTop: containerRect?.top || 0,
        sourceWidth: container?.offsetWidth || 200,
        sourceHeight: container?.offsetHeight || 100,
    };
}

export function updateImageDragPlaceholderMargin(alignment: Alignment): void {
    const placeholder = document.querySelector('.image-drag-placeholder') as HTMLElement | null;
    if (!placeholder) return;
    placeholder.style.margin = getPlaceholderMargin(alignment);
}
