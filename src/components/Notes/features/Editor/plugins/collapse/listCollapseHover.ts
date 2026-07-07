import type { EditorView } from '@milkdown/kit/prose/view';
import { LIST_NESTED_LIST_HOVER_CLASS } from './listCollapseConstants';

function getEventTargetElement(root: HTMLElement, target: EventTarget | null): Element | null {
    if (!target) return null;
    if (target instanceof Element) {
        return root.contains(target) ? target : null;
    }
    if (target instanceof Node && target.parentElement) {
        return root.contains(target.parentElement) ? target.parentElement : null;
    }
    return null;
}

export function collectNestedListHoverParents(root: HTMLElement, target: EventTarget | null): HTMLElement[] {
    const element = getEventTargetElement(root, target);
    if (!element) return [];

    const parents: HTMLElement[] = [];
    let currentList: Element | null = element.closest('ul, ol');

    while (currentList && root.contains(currentList)) {
        const parent = currentList.parentElement;
        if (parent instanceof HTMLLIElement && root.contains(parent)) {
            parents.push(parent);
        }

        const parentList = parent?.parentElement ?? null;
        currentList = parentList?.matches('ul, ol') ? parentList : null;
    }

    return parents;
}

function syncNestedListHoverParents(current: Set<HTMLElement>, nextParents: readonly HTMLElement[]): Set<HTMLElement> {
    const next = new Set(nextParents);
    current.forEach((element) => {
        if (!next.has(element)) {
            element.classList.remove(LIST_NESTED_LIST_HOVER_CLASS);
        }
    });
    next.forEach((element) => {
        if (!current.has(element)) {
            element.classList.add(LIST_NESTED_LIST_HOVER_CLASS);
        }
    });
    return next;
}

export function createNestedListHoverView(editorView: EditorView) {
    const root = editorView.dom;
    let currentParents = new Set<HTMLElement>();

    const updateFromTarget = (target: EventTarget | null) => {
        currentParents = syncNestedListHoverParents(
            currentParents,
            collectNestedListHoverParents(root, target),
        );
    };
    const clear = () => {
        currentParents = syncNestedListHoverParents(currentParents, []);
    };
    const handlePointerOver = (event: PointerEvent) => updateFromTarget(event.target);
    const handlePointerOut = (event: PointerEvent) => updateFromTarget(event.relatedTarget);

    root.addEventListener('pointerover', handlePointerOver);
    root.addEventListener('pointerout', handlePointerOut);
    root.addEventListener('pointercancel', clear);
    root.addEventListener('mouseleave', clear);

    return {
        destroy() {
            root.removeEventListener('pointerover', handlePointerOver);
            root.removeEventListener('pointerout', handlePointerOut);
            root.removeEventListener('pointercancel', clear);
            root.removeEventListener('mouseleave', clear);
            clear();
        },
    };
}
