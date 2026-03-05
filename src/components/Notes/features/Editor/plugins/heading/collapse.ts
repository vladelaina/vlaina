import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
    collectCollapsedRanges,
    collectTopLevelNodes,
    findCollapsedRangeContainingPos,
    findCollapsedRangeIntersectingSelection,
    getCollapsedNodePositions,
    type CollapsedSection,
} from './headingCollapseUtils';
import {
    applyCollapseAction,
    parseCollapseMetaAction,
    remapCollapsedHeadings,
    type CollapseMetaAction,
} from './headingCollapseState';
import {
    findCollapsedSectionAtOrBoundaryPos,
    findCollapsedSectionByBoundaryPos,
    resolveExpandedSectionTailPos,
    resolveTailRedirectPos,
    setSelectionAtPos,
} from './headingCollapseSelection';

const COLLAPSE_PLUGIN_KEY = new PluginKey<HeadingCollapsePluginState>('headingCollapse');
const COLLAPSE_SELECTION_GUARD_META = 'heading-collapse-selection-guard';

interface HeadingCollapsePluginState {
    decorations: DecorationSet;
    collapsedHeadings: Set<number>;
}

const buildDecorations = (doc: any, collapsedHeadings: Set<number>): DecorationSet => {
    const decorations: Decoration[] = [];
    const nodes = collectTopLevelNodes(doc);

    nodes.forEach((nodeInfo, index) => {
        if (nodeInfo.node.type.name !== 'heading') return;

        const headingPos = nodeInfo.pos;
        const collapsedRanges = getCollapsedNodePositions(nodes, index);
        const hasContent = collapsedRanges.length > 0;
        const isCollapsed = hasContent && collapsedHeadings.has(headingPos);

        decorations.push(createToggleWidgetDecoration(headingPos, isCollapsed, hasContent));

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
};

const createToggleWidgetDecoration = (
    headingPos: number,
    isCollapsed: boolean,
    hasContent: boolean,
): Decoration => {
    return Decoration.widget(
        headingPos + 1,
        (view) => {
            const button = document.createElement('span');
            button.className = 'heading-toggle-btn';
            button.setAttribute('data-collapsed', String(isCollapsed));
            button.setAttribute('data-has-content', String(hasContent));
            button.setAttribute('contenteditable', 'false');
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.15 15.132a.757.757 0 0 1-1.3 0L8.602 9.605c-.29-.491.072-1.105.65-1.105h6.497c.577 0 .938.614.65 1.105z"/>
                </svg>
            `;

            button.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!hasContent) return;

                const action: CollapseMetaAction = {
                    type: isCollapsed ? 'expand' : 'collapse',
                    headingPos,
                };
                const tr = view.state.tr.setMeta(COLLAPSE_PLUGIN_KEY, action);
                view.dispatch(tr);
                view.focus();
            });

            return button;
        },
        {
            side: -1,
            key: `toggle-${headingPos}-${isCollapsed ? '1' : '0'}-${hasContent ? '1' : '0'}`,
        },
    );
};

const createExpandAndRedirectTransaction = (
    state: any,
    headingPos: number,
    section: CollapsedSection,
) => {
    const tr = state.tr;
    tr.setMeta(COLLAPSE_PLUGIN_KEY, { type: 'expand', headingPos } satisfies CollapseMetaAction);

    const docEnd = tr.doc.content.size;
    const endsAtDocumentTail = section.to >= docEnd;
    const paragraphType = tr.doc.type.schema.nodes.paragraph;

    if (endsAtDocumentTail && paragraphType) {
        tr.insert(docEnd, paragraphType.create());
        setSelectionAtPos(tr, docEnd + 1, 1);
    } else {
        setSelectionAtPos(tr, resolveExpandedSectionTailPos(section), -1);
    }

    tr.setMeta(COLLAPSE_SELECTION_GUARD_META, true);
    return tr.scrollIntoView();
};

export const collapsePlugin = $prose(() => {
    return new Plugin<HeadingCollapsePluginState>({
        key: COLLAPSE_PLUGIN_KEY,

        state: {
            init(_config, state) {
                const collapsedHeadings = new Set<number>();
                return {
                    collapsedHeadings,
                    decorations: buildDecorations(state.doc, collapsedHeadings),
                };
            },
            apply(tr, oldPluginState, _oldState, newState) {
                const metaAction = parseCollapseMetaAction(tr.getMeta(COLLAPSE_PLUGIN_KEY));

                if (!tr.docChanged && !metaAction) {
                    return {
                        collapsedHeadings: oldPluginState.collapsedHeadings,
                        decorations: oldPluginState.decorations.map(tr.mapping, tr.doc),
                    };
                }

                let collapsedHeadings = tr.docChanged
                    ? remapCollapsedHeadings(oldPluginState.collapsedHeadings, tr, newState.doc)
                    : new Set<number>(oldPluginState.collapsedHeadings);

                if (metaAction) {
                    collapsedHeadings = applyCollapseAction(collapsedHeadings, metaAction);
                }

                return {
                    collapsedHeadings,
                    decorations: buildDecorations(newState.doc, collapsedHeadings),
                };
            },
        },

        appendTransaction(transactions, _oldState, newState) {
            if (transactions.some((tr) => tr.getMeta(COLLAPSE_SELECTION_GUARD_META))) {
                return null;
            }

            const pluginState = COLLAPSE_PLUGIN_KEY.getState(newState);
            if (!pluginState || pluginState.collapsedHeadings.size === 0) return null;

            const nodes = collectTopLevelNodes(newState.doc);
            const collapsedRanges = collectCollapsedRanges(nodes, pluginState.collapsedHeadings);
            if (collapsedRanges.length === 0) return null;

            const { from, to, empty } = newState.selection;
            const collapsedRange = empty
                ? findCollapsedRangeContainingPos(collapsedRanges, from)
                : findCollapsedRangeIntersectingSelection(collapsedRanges, from, to);

            if (!collapsedRange) {
                if (!empty) return null;

                const sectionAtBoundary = findCollapsedSectionByBoundaryPos(collapsedRanges, from);
                if (!sectionAtBoundary) return null;
                return createExpandAndRedirectTransaction(newState, sectionAtBoundary.headingPos, sectionAtBoundary);
            }

            const section = findCollapsedSectionAtOrBoundaryPos(collapsedRanges, collapsedRange.from);
            if (!section) return null;

            const docEnd = newState.doc.content.size;
            const isTailCollapsedSection = section.to >= docEnd;
            if (empty && isTailCollapsedSection && from >= section.from && from <= section.to) {
                return createExpandAndRedirectTransaction(newState, collapsedRange.headingPos, section);
            }

            if (empty && from === section.to) {
                return createExpandAndRedirectTransaction(newState, collapsedRange.headingPos, section);
            }

            const redirectTargetPos = section.to < docEnd
                ? section.to
                : resolveTailRedirectPos(newState.doc, collapsedRange.headingPos, section.from);
            const redirectBias: 1 | -1 = section.to < docEnd ? 1 : -1;

            const tr = newState.tr;
            const redirectResult = setSelectionAtPos(tr, redirectTargetPos, redirectBias);
            if (!redirectResult.changed) return null;

            tr.setMeta(COLLAPSE_SELECTION_GUARD_META, true);
            return tr.scrollIntoView();
        },

        props: {
            decorations(state) {
                return this.getState(state)?.decorations ?? DecorationSet.empty;
            },
            handleDOMEvents: {
                mousedown(view, event) {
                    if (!(event instanceof MouseEvent)) return false;
                    if (!(event.target instanceof Node)) return false;
                    if (!view.dom.contains(event.target)) return false;

                    const pluginState = COLLAPSE_PLUGIN_KEY.getState(view.state);
                    if (!pluginState || pluginState.collapsedHeadings.size === 0) return false;

                    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                    if (!coords) return false;

                    const nodes = collectTopLevelNodes(view.state.doc);
                    const collapsedRanges = collectCollapsedRanges(nodes, pluginState.collapsedHeadings);
                    const section = findCollapsedSectionAtOrBoundaryPos(collapsedRanges, coords.pos);
                    if (!section) return false;

                    const headingDom = view.nodeDOM(section.headingPos) as HTMLElement | null;
                    if (!headingDom) return false;
                    const headingRect = headingDom.getBoundingClientRect();
                    if (event.clientY <= headingRect.bottom) return false;

                    const tr = createExpandAndRedirectTransaction(view.state, section.headingPos, section);
                    view.dispatch(tr);
                    view.focus();
                    event.preventDefault();
                    return true;
                },
            },
        },
    });
});
