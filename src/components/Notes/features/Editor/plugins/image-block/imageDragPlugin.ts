import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, EditorView } from '@milkdown/kit/prose/view';
import type { Alignment } from './types';

const EDITOR_PADDING = 80;
const CONTAINER_PADDING = 60;
const DEFAULT_PLACEHOLDER_HEIGHT = 100;
const PLACEHOLDER_MARGIN = 8;
const PLACEHOLDER_BORDER_RADIUS = 8;

export const imageDragPluginKey = new PluginKey<ImageDragState>('imageDragPlugin');

interface ImageDragState {
    sourcePos: number | null;
    targetPos: number | null;
    isDragging: boolean;
    imageNaturalWidth: number;
    imageNaturalHeight: number;
    editorView: EditorView | null;
    alignment: Alignment;
}

const initialState: ImageDragState = {
    sourcePos: null,
    targetPos: null,
    isDragging: false,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    editorView: null,
    alignment: 'center',
};

export function setDragState(view: EditorView, state: Partial<ImageDragState>) {
    const tr = view.state.tr.setMeta(imageDragPluginKey, { ...state, editorView: view });
    view.dispatch(tr);
}

export function clearDragState(view: EditorView) {
    setDragState(view, {
        sourcePos: null,
        targetPos: null,
        isDragging: false,
        editorView: null,
        alignment: 'center',
    });
}

export function getDragState(view: EditorView): ImageDragState {
    return imageDragPluginKey.getState(view.state) || initialState;
}

export function calculateAlignmentFromPosition(view: EditorView, clientX: number): Alignment {
    const editorRect = view.dom.getBoundingClientRect();
    const relativeX = clientX - editorRect.left;
    const editorWidth = editorRect.width;
    const ratio = relativeX / editorWidth;

    if (ratio < 0.33) return 'left';
    if (ratio > 0.67) return 'right';
    return 'center';
}

interface DropTarget {
    pos: number;
    endPos: number;
    top: number;
    bottom: number;
    depth: number;
    nodeType: string;
    canInsertParagraph: boolean;
}

const CONTAINER_TYPES = [
    'bullet_list',
    'ordered_list',
    'list_item',
    'blockquote',
    'callout',
    'table',
    'table_row',
];

const PARAGRAPH_CONTAINERS = ['blockquote', 'callout', 'list_item'];

export function calculateDropPosition(view: EditorView, clientY: number, sourcePos: number): number | null {
    const { state } = view;
    const { doc } = state;

    const $sourcePos = doc.resolve(sourcePos);
    const sourceParentPos = $sourcePos.before($sourcePos.depth);
    const sourceParentNode = $sourcePos.node($sourcePos.depth);
    const sourceParentEndPos = sourceParentPos + sourceParentNode.nodeSize;

    const dropTargets: DropTarget[] = [];

    const collectDropTargets = (node: typeof doc, startPos: number, depth: number, parentCanContainParagraph: boolean) => {
        node.forEach((child, childOffset) => {
            const childPos = startPos + childOffset;
            const childEndPos = childPos + child.nodeSize;

            const canInsert = depth === 0 ? true : parentCanContainParagraph;
            
            let dom = view.nodeDOM(childPos) as HTMLElement | null;
            let rect: DOMRect | null = null;
            
            if (dom) {
                rect = dom.getBoundingClientRect();
            } else {
                try {
                    const coords = view.coordsAtPos(childPos);
                    const endCoords = view.coordsAtPos(childEndPos);
                    rect = new DOMRect(coords.left, coords.top, endCoords.right - coords.left, endCoords.bottom - coords.top);
                } catch (e) {
                    return;
                }
            }

            if (rect) {
                dropTargets.push({
                    pos: childPos,
                    endPos: childEndPos,
                    top: rect.top,
                    bottom: rect.bottom,
                    depth,
                    nodeType: child.type.name,
                    canInsertParagraph: canInsert,
                });

                if (child.isBlock && child.childCount > 0 && CONTAINER_TYPES.includes(child.type.name)) {
                    const childCanContainParagraph = PARAGRAPH_CONTAINERS.includes(child.type.name);
                    collectDropTargets(child, childPos + 1, depth + 1, childCanContainParagraph);
                }
            }
        });
    };

    collectDropTargets(doc, 0, 0, true);

    if (dropTargets.length === 0) {
        try {
            const startCoords = view.coordsAtPos(0);
            const endCoords = view.coordsAtPos(doc.content.size);
            
            dropTargets.push({
                pos: 0,
                endPos: 0,
                top: startCoords.top - 100,
                bottom: startCoords.bottom + 50,
                depth: 0,
                nodeType: 'doc',
                canInsertParagraph: true,
            });
            
            dropTargets.push({
                pos: doc.content.size,
                endPos: doc.content.size,
                top: endCoords.top - 50,
                bottom: endCoords.bottom + 100,
                depth: 0,
                nodeType: 'doc',
                canInsertParagraph: true,
            });
        } catch (e) {
            // Silently fail if we can't get document boundary coords
        }
    }

    let bestTarget: DropTarget | null = null;
    let bestDistance = Infinity;

    const containingTargets = dropTargets.filter(t => clientY >= t.top && clientY <= t.bottom);

    if (containingTargets.length > 0) {
        containingTargets.sort((a, b) => {
            if (b.depth !== a.depth) return b.depth - a.depth;
            if (a.canInsertParagraph !== b.canInsertParagraph) {
                return a.canInsertParagraph ? -1 : 1;
            }
            return 0;
        });
        bestTarget = containingTargets.find(t => t.canInsertParagraph) || containingTargets[0];
        bestDistance = 0;
    } else {
        for (const target of dropTargets) {
            const distance = clientY < target.top
                ? target.top - clientY
                : clientY - target.bottom;

            if (distance < bestDistance) {
                bestDistance = distance;
                bestTarget = target;
            }
        }
    }

    if (!bestTarget) {
        return sourcePos;
    }

    const midPoint = (bestTarget.top + bestTarget.bottom) / 2;
    let targetPos = clientY < midPoint ? bestTarget.pos : bestTarget.endPos;

    if (targetPos === sourceParentPos || targetPos === sourceParentEndPos) {
        if (targetPos === sourceParentEndPos && targetPos < doc.content.size) {
            const $next = doc.resolve(targetPos);
            if ($next.nodeAfter) {
                targetPos = targetPos + $next.nodeAfter.nodeSize;
            } else {
                return null;
            }
        } else if (targetPos === sourceParentPos && targetPos > 0) {
            const $prev = doc.resolve(targetPos);
            if ($prev.nodeBefore) {
                targetPos = targetPos - $prev.nodeBefore.nodeSize;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    if (targetPos < 0 || targetPos > doc.content.size) {
        return null;
    }

    return targetPos;
}

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
            height: (containerWidth / imageNaturalWidth) * imageNaturalHeight
        };
    }

    return { width: imageNaturalWidth, height: imageNaturalHeight };
}

function createPlaceholderDecoration(
    pos: number,
    view: EditorView,
    imageNaturalWidth: number,
    imageNaturalHeight: number,
    alignment: Alignment
): Decoration {
    const { width, height } = calculatePlaceholderSize(pos, view, imageNaturalWidth, imageNaturalHeight);

    const marginMap = {
        left: `${PLACEHOLDER_MARGIN}px auto ${PLACEHOLDER_MARGIN}px 0`,
        center: `${PLACEHOLDER_MARGIN}px auto`,
        right: `${PLACEHOLDER_MARGIN}px 0 ${PLACEHOLDER_MARGIN}px auto`,
    };

    const placeholder = document.createElement('div');
    placeholder.className = 'image-drag-placeholder';
    placeholder.style.cssText = `
        height: ${height}px;
        width: ${width}px;
        margin: ${marginMap[alignment]};
        border: 3px dashed var(--neko-accent, #3b82f6);
        border-radius: ${PLACEHOLDER_BORDER_RADIUS}px;
        background: rgba(59, 130, 246, 0.1);
    `;

    return Decoration.widget(pos, placeholder, {
        side: -1,
        key: 'image-drag-placeholder'
    });
}

export const imageDragPlugin = $prose(() => {
    return new Plugin({
        key: imageDragPluginKey,

        state: {
            init(): ImageDragState {
                return { ...initialState };
            },

            apply(tr, value): ImageDragState {
                const meta = tr.getMeta(imageDragPluginKey);
                if (meta) {
                    return { ...value, ...meta };
                }
                return value;
            }
        },

        props: {
            decorations(state) {
                const pluginState = imageDragPluginKey.getState(state);

                if (!pluginState?.isDragging || pluginState.targetPos === null || !pluginState.editorView) {
                    return DecorationSet.empty;
                }

                if (pluginState.targetPos < 0 || pluginState.targetPos > state.doc.content.size) {
                    return DecorationSet.empty;
                }

                const decoration = createPlaceholderDecoration(
                    pluginState.targetPos,
                    pluginState.editorView,
                    pluginState.imageNaturalWidth,
                    pluginState.imageNaturalHeight,
                    pluginState.alignment
                );

                return DecorationSet.create(state.doc, [decoration]);
            }
        }
    });
});
