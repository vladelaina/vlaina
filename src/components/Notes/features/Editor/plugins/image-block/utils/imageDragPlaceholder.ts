import { Decoration, type EditorView } from '@milkdown/kit/prose/view';
import type { Alignment } from '../types';

const EDITOR_PADDING = 80;
const CONTAINER_PADDING = 60;
const DEFAULT_PLACEHOLDER_HEIGHT = 100;
const PLACEHOLDER_MARGIN = 8;
const PLACEHOLDER_BORDER_RADIUS = 8;
const CONTAINER_TYPES = ['bullet_list', 'ordered_list', 'list_item', 'blockquote', 'callout', 'table', 'table_row'];

function calculatePlaceholderSize(
    pos: number,
    view: EditorView,
    imageNaturalWidth: number,
    imageNaturalHeight: number
): { width: number; height: number } {
    const $pos = view.state.doc.resolve(pos);
    let containerWidth = view.dom.clientWidth - EDITOR_PADDING;

    for (let d = $pos.depth; d >= 1; d--) {
        const ancestor = $pos.node(d);
        const ancestorPos = $pos.before(d);
        const ancestorDom = view.nodeDOM(ancestorPos) as HTMLElement | null;

        if (ancestorDom && CONTAINER_TYPES.includes(ancestor.type.name)) {
            containerWidth = ancestorDom.clientWidth - CONTAINER_PADDING;
            break;
        }
    }

    if (imageNaturalWidth <= 0 || imageNaturalHeight <= 0) {
        return { width: containerWidth, height: DEFAULT_PLACEHOLDER_HEIGHT };
    }

    if (imageNaturalWidth > containerWidth) {
        return {
            width: containerWidth,
            height: (containerWidth / imageNaturalWidth) * imageNaturalHeight,
        };
    }

    return { width: imageNaturalWidth, height: imageNaturalHeight };
}

export function getPlaceholderMargin(alignment: Alignment): string {
    const marginMap = {
        left: `${PLACEHOLDER_MARGIN}px auto ${PLACEHOLDER_MARGIN}px 0`,
        center: `${PLACEHOLDER_MARGIN}px auto`,
        right: `${PLACEHOLDER_MARGIN}px 0 ${PLACEHOLDER_MARGIN}px auto`,
    } as const;
    return marginMap[alignment];
}

export function createPlaceholderDecoration(
    pos: number,
    view: EditorView,
    imageNaturalWidth: number,
    imageNaturalHeight: number,
    alignment: Alignment
): Decoration {
    const { width, height } = calculatePlaceholderSize(pos, view, imageNaturalWidth, imageNaturalHeight);
    const placeholder = document.createElement('div');

    placeholder.className = 'image-drag-placeholder';
    placeholder.style.cssText = `
        height: ${height}px;
        width: ${width}px;
        margin: ${getPlaceholderMargin(alignment)};
        border: 3px dashed var(--neko-accent, #3b82f6);
        border-radius: ${PLACEHOLDER_BORDER_RADIUS}px;
        background: rgba(59, 130, 246, 0.1);
    `;

    return Decoration.widget(pos, placeholder, {
        side: -1,
        key: 'image-drag-placeholder',
    });
}
