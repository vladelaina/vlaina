import type { EditorView } from '@milkdown/kit/prose/view';
import type { Alignment } from '../types';

interface DropTarget {
    pos: number;
    endPos: number;
    top: number;
    bottom: number;
    depth: number;
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

export function calculateAlignmentFromPosition(view: EditorView, clientX: number): Alignment {
    const editorRect = view.dom.getBoundingClientRect();
    const relativeX = clientX - editorRect.left;
    const ratio = relativeX / editorRect.width;
    if (ratio < 0.33) return 'left';
    if (ratio > 0.67) return 'right';
    return 'center';
}

export function calculateDropPosition(view: EditorView, clientY: number, sourcePos: number): number | null {
    const { doc } = view.state;

    const $sourcePos = doc.resolve(sourcePos);
    const sourceParentPos = $sourcePos.before($sourcePos.depth);
    const sourceParentNode = $sourcePos.node($sourcePos.depth);
    const sourceParentEndPos = sourceParentPos + sourceParentNode.nodeSize;

    const dropTargets: DropTarget[] = [];

    const collectDropTargets = (
        node: typeof doc,
        startPos: number,
        depth: number,
        parentCanContainParagraph: boolean
    ) => {
        node.forEach((child, childOffset) => {
            const childPos = startPos + childOffset;
            const childEndPos = childPos + child.nodeSize;

            const canInsert = depth === 0 ? true : parentCanContainParagraph;
            let rect: DOMRect | null = null;

            const dom = view.nodeDOM(childPos) as HTMLElement | null;
            if (dom) {
                rect = dom.getBoundingClientRect();
            } else {
                try {
                    const coords = view.coordsAtPos(childPos);
                    const endCoords = view.coordsAtPos(childEndPos);
                    rect = new DOMRect(coords.left, coords.top, endCoords.right - coords.left, endCoords.bottom - coords.top);
                } catch {
                    return;
                }
            }

            if (!rect) return;

            dropTargets.push({
                pos: childPos,
                endPos: childEndPos,
                top: rect.top,
                bottom: rect.bottom,
                depth,
                canInsertParagraph: canInsert,
            });

            if (child.isBlock && child.childCount > 0 && CONTAINER_TYPES.includes(child.type.name)) {
                const childCanContainParagraph = PARAGRAPH_CONTAINERS.includes(child.type.name);
                collectDropTargets(child, childPos + 1, depth + 1, childCanContainParagraph);
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
                canInsertParagraph: true,
            });
            dropTargets.push({
                pos: doc.content.size,
                endPos: doc.content.size,
                top: endCoords.top - 50,
                bottom: endCoords.bottom + 100,
                depth: 0,
                canInsertParagraph: true,
            });
        } catch {
            // Ignore boundary fallback failure
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
    } else {
        for (const target of dropTargets) {
            const distance = clientY < target.top ? target.top - clientY : clientY - target.bottom;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestTarget = target;
            }
        }
    }

    if (!bestTarget) return sourcePos;

    const midPoint = (bestTarget.top + bestTarget.bottom) / 2;
    let targetPos = clientY < midPoint ? bestTarget.pos : bestTarget.endPos;

    if (targetPos === sourceParentPos || targetPos === sourceParentEndPos) {
        if (targetPos === sourceParentEndPos && targetPos < doc.content.size) {
            const $next = doc.resolve(targetPos);
            if ($next.nodeAfter) {
                targetPos += $next.nodeAfter.nodeSize;
            } else {
                return null;
            }
        } else if (targetPos === sourceParentPos && targetPos > 0) {
            const $prev = doc.resolve(targetPos);
            if ($prev.nodeBefore) {
                targetPos -= $prev.nodeBefore.nodeSize;
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
