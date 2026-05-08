import { createCollapseTriangleSvgMarkup } from '../../../common/collapseTriangle';

export const COLLAPSED_CONTENT_CLASS = 'vlaina-collapsed-content';

export const COLLAPSE_TOGGLE_BUTTON_CLASS = 'vlaina-collapse-btn';

interface CollapseToggleButtonOptions {
    className?: string;
    collapseType?: string;
    collapsed: boolean;
    hasContent: boolean;
    onToggle: (event: Event) => void;
}

export function isCollapseToggleTarget(
    target: EventTarget | null,
    className = COLLAPSE_TOGGLE_BUTTON_CLASS,
): boolean {
    return target instanceof Element && !!target.closest(`.${className}`);
}

export function blurActiveElement(ownerDocument: Document): void {
    const activeElement = ownerDocument.activeElement;
    if (activeElement instanceof HTMLElement || activeElement instanceof SVGElement) {
        activeElement.blur();
    }
}

export function createCollapseToggleButton({
    className = COLLAPSE_TOGGLE_BUTTON_CLASS,
    collapseType,
    collapsed,
    hasContent,
    onToggle,
}: CollapseToggleButtonOptions): HTMLElement {
    const button = document.createElement('span');
    button.className = className;
    if (collapseType) {
        button.setAttribute('data-collapse-type', collapseType);
    }
    button.setAttribute('data-collapsed', String(collapsed));
    button.setAttribute('data-has-content', String(hasContent));
    button.setAttribute('contenteditable', 'false');

    button.innerHTML = createCollapseTriangleSvgMarkup(16);

    const handleTogglePointer = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();

        if (!hasContent) return;
        blurActiveElement(button.ownerDocument);
        onToggle(e);
    };

    const stopClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
    };

    if (typeof PointerEvent !== 'undefined') {
        button.addEventListener('pointerdown', handleTogglePointer);
    } else {
        button.addEventListener('mousedown', handleTogglePointer);
    }
    button.addEventListener('click', stopClick);

    return button;
}
