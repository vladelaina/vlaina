import { createCollapseTriangleSvgMarkup } from '../../../common/collapseTriangle';

export const COLLAPSED_CONTENT_CLASS = 'neko-collapsed-content';

export const COLLAPSE_TOGGLE_EVENT = 'neko-collapse-toggle';

class CollapsedStateManager {
    private states: Map<string, Set<number>> = new Map();

    getSet(type: string): Set<number> {
        if (!this.states.has(type)) {
            this.states.set(type, new Set());
        }
        return this.states.get(type)!;
    }

    isCollapsed(type: string, pos: number): boolean {
        return this.getSet(type).has(pos);
    }

    toggle(type: string, pos: number): boolean {
        const set = this.getSet(type);
        const wasCollapsed = set.has(pos);
        if (wasCollapsed) {
            set.delete(pos);
        } else {
            set.add(pos);
        }
        return !wasCollapsed; // Return new state
    }

    setCollapsed(type: string, pos: number, collapsed: boolean): void {
        const set = this.getSet(type);
        if (collapsed) {
            set.add(pos);
        } else {
            set.delete(pos);
        }
    }
}

export const collapsedState = new CollapsedStateManager();

export function createCollapseToggleButton(
    type: string,
    pos: number,
    isCollapsed: boolean,
    hasContent: boolean
): HTMLElement {

    const button = document.createElement('span');
    button.className = 'neko-collapse-btn';
    button.setAttribute('data-collapse-type', type);
    button.setAttribute('data-collapsed', String(isCollapsed));
    button.setAttribute('data-has-content', String(hasContent));
    button.setAttribute('contenteditable', 'false');

    button.innerHTML = createCollapseTriangleSvgMarkup(16);

    button.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const newState = collapsedState.toggle(type, pos);
        button.setAttribute('data-collapsed', String(newState));

        const event = new CustomEvent(COLLAPSE_TOGGLE_EVENT, {
            detail: { type, pos }
        });
        document.dispatchEvent(event);
    });

    return button;
}

export function dispatchCollapseToggle(type: string, pos: number): void {
    const event = new CustomEvent(COLLAPSE_TOGGLE_EVENT, {
        detail: { type, pos }
    });
    document.dispatchEvent(event);
}
