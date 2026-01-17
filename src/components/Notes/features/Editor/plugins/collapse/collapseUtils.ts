/**
 * Collapse Utilities
 * 
 * Shared utilities for collapsible content (headings, lists, etc.)
 */

// CSS class for collapsed content
export const COLLAPSED_CONTENT_CLASS = 'neko-collapsed-content';

// Custom event name for triggering collapse re-render
export const COLLAPSE_TOGGLE_EVENT = 'neko-collapse-toggle';

/**
 * Collapsed state manager - tracks collapsed positions by type
 */
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

// Global singleton for collapsed state
export const collapsedState = new CollapsedStateManager();

/**
 * Create a toggle button element for collapse/expand
 */
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

    // Triangle icon
    button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.15 15.132a.757.757 0 0 1-1.3 0L8.602 9.605c-.29-.491.072-1.105.65-1.105h6.497c.577 0 .938.614.65 1.105z"/>
    </svg>
  `;

    button.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const newState = collapsedState.toggle(type, pos);
        button.setAttribute('data-collapsed', String(newState));

        // Dispatch custom event to trigger re-render
        const event = new CustomEvent(COLLAPSE_TOGGLE_EVENT, {
            detail: { type, pos }
        });
        document.dispatchEvent(event);
    });

    return button;
}

/**
 * Dispatch a collapse toggle event
 */
export function dispatchCollapseToggle(type: string, pos: number): void {
    const event = new CustomEvent(COLLAPSE_TOGGLE_EVENT, {
        detail: { type, pos }
    });
    document.dispatchEvent(event);
}
