import { Plugin } from '@milkdown/kit/prose/state';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import {
    buildInternalListGapDecorations,
    transactionMayAffectInternalListGapDecorations,
} from './listGapPlaceholders';
import {
    handleEmptyParentListItemBackspace,
    handleInternalPlaceholderListDeletion,
    handleInternalPlaceholderListEnter,
    handleListTabIndent,
} from './listGapKeyboard';
import { handleInternalPlaceholderOrderedListTextInput } from './listGapTextInput';
import { listTabIndentPluginKey } from './listTabIndentConstants';
import {
    docChangeMayAffectOrderedListNormalization,
    normalizeOrderedListsAfterChange,
} from './orderedListNormalization';

export {
    EDITABLE_LIST_GAP_PLACEHOLDER,
    LIST_GAP_PLACEHOLDER_CLASS,
    LIST_GAP_PLACEHOLDER_TASK_LIST_CLASS,
    MAX_ADJACENT_ORDERED_LIST_MERGE_SCAN_NODES,
    MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES,
    MAX_LIST_GAP_PLACEHOLDER_DECORATIONS,
    MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS,
    MAX_LIST_GAP_TRANSACTION_STEP_TEXT_CHARS,
    MAX_ORDERED_LIST_LABEL_SCAN_NODES,
    MAX_ORDERED_LIST_LABEL_UPDATES,
    VISIBLE_LIST_GAP_TEXT_PATTERN,
    listTabIndentPluginKey,
} from './listTabIndentConstants';
export {
    buildInternalListGapDecorations,
    collectInternalListGapDecorations,
    collectInternalListGapPlaceholderCleanupRanges,
    isInternalListGapPlaceholderNode,
    listItemContainsInternalGapPlaceholder,
    transactionMayAffectInternalListGapDecorations,
} from './listGapPlaceholders';
export {
    collectOrderedListLabelUpdates,
} from './orderedListLabels';
export {
    docChangeMayAffectOrderedListNormalization,
    findAdjacentOrderedLists,
    rangeTouchesOrderedListNormalizationNode,
} from './orderedListNormalization';

export const listTabIndentPlugin = $prose(() => {
    return new Plugin({
        key: listTabIndentPluginKey,
        state: {
            init(_config, state) {
                return buildInternalListGapDecorations(state.doc);
            },
            apply(tr, previous, _oldState, newState) {
                if (!tr.docChanged) return previous.map(tr.mapping, tr.doc);
                if (!transactionMayAffectInternalListGapDecorations(
                    previous,
                    tr,
                    _oldState.doc,
                    newState.doc
                )) {
                    return previous.map(tr.mapping, newState.doc);
                }
                return buildInternalListGapDecorations(newState.doc);
            },
        },
        appendTransaction(transactions, oldState, newState) {
            if (!transactions.some((tr) => tr.docChanged)) return null;
            if (!docChangeMayAffectOrderedListNormalization(oldState.doc, newState.doc)) return null;
            return normalizeOrderedListsAfterChange(newState);
        },
        props: {
            decorations(state) {
                return this.getState(state) ?? DecorationSet.empty;
            },
            handleTextInput(view, from, to, text) {
                return handleInternalPlaceholderOrderedListTextInput(view, from, to, text);
            },
            handleKeyDown(view, event) {
                if (handleInternalPlaceholderListEnter(view, event)) return true;
                if (handleInternalPlaceholderListDeletion(view, event)) return true;
                if (handleEmptyParentListItemBackspace(view, event)) return true;
                return handleListTabIndent(view, event);
            },
        },
    });
});
