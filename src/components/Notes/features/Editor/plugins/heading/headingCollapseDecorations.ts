import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { createCollapseToggleButton, isCollapseToggleTarget } from '../collapse/collapseUtils';
import { getCollapsedNodePositions, type PositionedNode, type TopLevelNodeLike } from './headingCollapseUtils';

interface BuildHeadingCollapseDecorationsOptions<TNode extends TopLevelNodeLike> {
    doc: any;
    nodes: Array<PositionedNode<TNode>>;
    collapsedHeadings: Set<number>;
    dispatchToggle: (view: EditorView, headingPos: number, isCollapsed: boolean) => void;
}

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

    nodes.forEach((nodeInfo, index) => {
        if (nodeInfo.node.type.name !== 'heading') return;

        const headingPos = nodeInfo.pos;
        const collapsedRanges = getCollapsedNodePositions(nodes, index);
        const hasContent = collapsedRanges.length > 0;
        const isCollapsed = hasContent && collapsedHeadings.has(headingPos);

        if (hasContent) {
            decorations.push(
                createToggleWidgetDecoration(headingPos, isCollapsed, hasContent, dispatchToggle),
            );
        }

        if (!isCollapsed) return;
        collapsedRanges.forEach((range) => {
            decorations.push(
                Decoration.node(range.from, range.to, {
                    class: 'heading-collapsed-content',
                }),
            );
        });
    });

    return DecorationSet.create(doc, decorations);
}
