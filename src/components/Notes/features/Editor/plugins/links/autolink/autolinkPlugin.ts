import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { createAutolinkDecorations } from './autolinkDecorations';
import {
    transactionChangedContextMayContainAutolinkCandidate,
    transactionMayAffectExistingAutolinks,
    transactionMayCreateAutolink,
    updateAutolinkDecorationsForTransaction,
} from './autolinkTransactions';

export {
    MAX_AUTOLINK_DECORATIONS,
    MAX_AUTOLINK_DOC_SCAN_NODES,
    MAX_AUTOLINK_TEXT_SCAN_CHARS,
    MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS,
    MAX_AUTOLINK_UPDATE_RANGE_SCAN_NODES,
} from './autolinkConstants';
export {
    collectAutolinkDecorations,
    collectAutolinkDecorationsInRange,
    findUrls,
    textMayContainAutolinkCandidate,
    trimTrailingUrlPunctuation,
} from './autolinkDecorations';
export {
    collectAutolinkUpdateRanges,
    transactionMayAffectExistingAutolinks,
    transactionMayCreateAutolink,
    updateAutolinkDecorationsForTransaction,
} from './autolinkTransactions';

export const autolinkPluginKey = new PluginKey('autolink');

export const autolinkPlugin = $prose(() => {
    return new Plugin({
        key: autolinkPluginKey,
        state: {
            init(_, { doc }) {
                return createAutolinkDecorations(doc);
            },
            apply(tr, old) {
                if (!tr.docChanged) {
                    return old;
                }

                const mayCreateAutolink = transactionMayCreateAutolink(tr);
                if (
                    !mayCreateAutolink
                    && !transactionMayAffectExistingAutolinks(old, tr)
                    && !transactionChangedContextMayContainAutolinkCandidate(tr.doc, tr)
                ) {
                    return old.map(tr.mapping, tr.doc);
                }

                return updateAutolinkDecorationsForTransaction(old, tr, tr.doc);
            }
        },
        props: {
            decorations(state) {
                return this.getState(state);
            },
            handleTextInput(view, from, to, text) {
                if (/\s/.test(text)) {
                    const { state } = view;
                    const { selection } = state;
                    const $pos = selection.$from;

                    const linkMark = state.schema.marks.link;
                    const hasLink = linkMark && $pos.marks().some(m => m.type.name === linkMark.name);

                    if (hasLink) {
                        const tr = state.tr.insertText(text, from, to);
                        tr.removeStoredMark(linkMark);
                        view.dispatch(tr);
                        return true;
                    }
                }
                return false;
            }
        }
    });
});
