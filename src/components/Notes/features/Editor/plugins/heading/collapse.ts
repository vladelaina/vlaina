import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { applyCollapseAction, parseCollapseMetaAction, remapCollapsedHeadings, type CollapseMetaAction } from './headingCollapseState';
import {
    createHeadingCollapseAppendTransaction,
    expandCollapsedHeadingSectionAtPos as expandCollapsedHeadingSectionAtPosInternal,
    handleHeadingCollapseMouseDown,
} from './headingCollapseInteractions';
import {
    buildHeadingCollapsePluginState,
    type HeadingCollapsePluginState,
} from './headingCollapsePluginState';

const COLLAPSE_PLUGIN_KEY = new PluginKey<HeadingCollapsePluginState>('headingCollapse');
const COLLAPSE_SELECTION_GUARD_META = 'heading-collapse-selection-guard';

function dispatchHeadingCollapseToggle(
    view: EditorView,
    headingPos: number,
    isCollapsed: boolean,
) {
    const action: CollapseMetaAction = {
        type: isCollapsed ? 'expand' : 'collapse',
        headingPos,
    };

    view.dispatch(view.state.tr.setMeta(COLLAPSE_PLUGIN_KEY, action));
}

export function expandCollapsedHeadingSectionAtPos(view: EditorView, pos: number): boolean {
    return expandCollapsedHeadingSectionAtPosInternal(view, pos, {
        pluginKey: COLLAPSE_PLUGIN_KEY,
        selectionGuardMeta: COLLAPSE_SELECTION_GUARD_META,
    });
}

export const collapsePlugin = $prose(() => {
    return new Plugin<HeadingCollapsePluginState>({
        key: COLLAPSE_PLUGIN_KEY,

        state: {
            init(_config, state) {
                return buildHeadingCollapsePluginState(
                    state.doc,
                    new Set<number>(),
                    dispatchHeadingCollapseToggle,
                );
            },
            apply(tr, oldPluginState, _oldState, newState) {
                const metaAction = parseCollapseMetaAction(tr.getMeta(COLLAPSE_PLUGIN_KEY));

                if (!tr.docChanged && !metaAction) {
                    return oldPluginState;
                }

                let collapsedHeadings = tr.docChanged
                    ? remapCollapsedHeadings(oldPluginState.collapsedHeadings, tr, newState.doc)
                    : new Set<number>(oldPluginState.collapsedHeadings);

                if (metaAction) {
                    collapsedHeadings = applyCollapseAction(collapsedHeadings, metaAction);
                }

                return buildHeadingCollapsePluginState(
                    newState.doc,
                    collapsedHeadings,
                    dispatchHeadingCollapseToggle,
                );
            },
        },

        appendTransaction(transactions, _oldState, newState) {
            return createHeadingCollapseAppendTransaction(transactions, newState, {
                pluginKey: COLLAPSE_PLUGIN_KEY,
                selectionGuardMeta: COLLAPSE_SELECTION_GUARD_META,
            });
        },

        props: {
            decorations(state) {
                return this.getState(state)?.decorations ?? DecorationSet.empty;
            },
            handleDOMEvents: {
                mousedown(view, event) {
                    return handleHeadingCollapseMouseDown(view, event, {
                        pluginKey: COLLAPSE_PLUGIN_KEY,
                        selectionGuardMeta: COLLAPSE_SELECTION_GUARD_META,
                    });
                },
            },
        },
    });
});
