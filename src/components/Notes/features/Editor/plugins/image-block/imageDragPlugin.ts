import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, EditorView } from '@milkdown/kit/prose/view';

export const imageDragPluginKey = new PluginKey<ImageDragState>('imageDragPlugin');

interface ImageDragState {
    sourcePos: number | null;
    targetPos: number | null;
    isDragging: boolean;
    sourceHeight: number;
}

const initialState: ImageDragState = {
    sourcePos: null,
    targetPos: null,
    isDragging: false,
    sourceHeight: 100,
};

export function setDragState(view: EditorView, state: Partial<ImageDragState>) {
    const tr = view.state.tr.setMeta(imageDragPluginKey, state);
    view.dispatch(tr);
}

export function clearDragState(view: EditorView) {
    setDragState(view, {
        sourcePos: null,
        targetPos: null,
        isDragging: false,
    });
}

export function getDragState(view: EditorView): ImageDragState {
    return imageDragPluginKey.getState(view.state) || initialState;
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

            if (childPos === sourceParentPos) return;

            const canInsert = depth === 0 ? true : parentCanContainParagraph;
            const dom = view.nodeDOM(childPos) as HTMLElement | null;

            if (dom) {
                const rect = dom.getBoundingClientRect();
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

    if (dropTargets.length === 0) return null;

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

    if (!bestTarget) return null;

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

    if (targetPos < 0 || targetPos > doc.content.size) return null;

    return targetPos;
}

function createPlaceholderDecoration(pos: number, height: number): Decoration {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-drag-placeholder';
    placeholder.style.cssText = `
        height: ${Math.min(height, 60)}px;
        margin: 8px 0;
        border: 3px dashed var(--neko-accent, #3b82f6);
        border-radius: 8px;
        background: rgba(59, 130, 246, 0.2);
        transition: all 0.15s ease-out;
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

                if (!pluginState?.isDragging || pluginState.targetPos === null) {
                    return DecorationSet.empty;
                }

                if (pluginState.targetPos < 0 || pluginState.targetPos > state.doc.content.size) {
                    return DecorationSet.empty;
                }

                const decoration = createPlaceholderDecoration(
                    pluginState.targetPos,
                    pluginState.sourceHeight
                );

                return DecorationSet.create(state.doc, [decoration]);
            }
        }
    });
});
