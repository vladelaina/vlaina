import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { createCollapseToggleButton, isCollapseToggleTarget } from '../collapse/collapseUtils';
import { getCollapsedNodePositions, type PositionedNode, type TopLevelNodeLike } from './headingCollapseUtils';

interface BuildHeadingCollapseDecorationsOptions<TNode extends TopLevelNodeLike> {
    doc: any;
    nodes: Array<PositionedNode<TNode>>;
    collapsedHeadings: Set<number>;
    dispatchToggle: (view: EditorView, headingPos: number, isCollapsed: boolean) => void;
}

const MAX_HEADING_COLLAPSE_TOGGLES = 1000;
const MAX_HEADING_COLLAPSE_CONTENT_DECORATIONS = 5000;

const createToggleWidgetDecoration = (
    headingPos: number,
    isCollapsed: boolean,
    hasContent: boolean,
    dispatchToggle: (view: EditorView, headingPos: number, isCollapsed: boolean) => void,
): Decoration => {
    return Decoration.widget(
        headingPos + 1,
        (view) => {
            return createCollapseToggleButton({
                className: 'heading-toggle-btn',
                collapsed: isCollapsed,
                hasContent,
                onToggle: () => {
                    dispatchToggle(view, headingPos, isCollapsed);
                    view.dom.blur();
                },
            });
        },
        {
            side: -1,
            key: `toggle-${headingPos}-${isCollapsed ? '1' : '0'}-${hasContent ? '1' : '0'}`,
            stopEvent(event) {
                return isCollapseToggleTarget(event.target, 'heading-toggle-btn');
            },
        },
    );
};

export function buildHeadingCollapseDecorations<TNode extends TopLevelNodeLike>({
    doc,
    nodes,
    collapsedHeadings,
    dispatchToggle,
}: BuildHeadingCollapseDecorationsOptions<TNode>): DecorationSet {
    const decorations: Decoration[] = [];
    let toggleCount = 0;
    let contentDecorationCount = 0;

    for (let index = 0; index < nodes.length; index += 1) {
        if (toggleCount >= MAX_HEADING_COLLAPSE_TOGGLES) break;
        const nodeInfo = nodes[index];
        if (nodeInfo.node.type.name !== 'heading') continue;

        const headingPos = nodeInfo.pos;
        const collapsedRanges = getCollapsedNodePositions(nodes, index);
        const hasContent = collapsedRanges.length > 0;
        const isCollapsed = hasContent && collapsedHeadings.has(headingPos);

        if (hasContent) {
            decorations.push(
                createToggleWidgetDecoration(headingPos, isCollapsed, hasContent, dispatchToggle),
            );
            toggleCount += 1;
        }

        if (!isCollapsed) continue;
        for (const range of collapsedRanges) {
            if (contentDecorationCount >= MAX_HEADING_COLLAPSE_CONTENT_DECORATIONS) break;
            decorations.push(
                Decoration.node(range.from, range.to, {
                    class: 'heading-collapsed-content',
                }),
            );
            contentDecorationCount += 1;
        }
    }

    return DecorationSet.create(doc, decorations);
}
