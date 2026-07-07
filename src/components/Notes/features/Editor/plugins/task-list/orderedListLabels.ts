import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
    MAX_ORDERED_LIST_LABEL_SCAN_NODES,
    MAX_ORDERED_LIST_LABEL_UPDATES,
} from './listTabIndentConstants';

export function collectOrderedListLabelUpdates(doc: ProseNode): Array<{
    attrs: Record<string, unknown>;
    pos: number;
}> {
    const updates: Array<{
        attrs: Record<string, unknown>;
        pos: number;
    }> = [];

    scanProseDescendants(doc, (node, pos, parent, index) => {
        if (updates.length >= MAX_ORDERED_LIST_LABEL_UPDATES) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'list_item' || parent?.type?.name !== 'ordered_list') {
            return true;
        }

        const parentAttrs = parent.attrs ?? {};
        const nodeAttrs = node.attrs ?? {};
        const order = typeof parentAttrs.order === 'number' ? parentAttrs.order : 1;
        const expectedLabel = `${order + (index ?? 0)}.`;
        const attrs = {
            ...nodeAttrs,
            label: expectedLabel,
            listType: 'ordered',
        };

        if (nodeAttrs.label !== attrs.label || nodeAttrs.listType !== attrs.listType) {
            updates.push({ attrs, pos });
        }

        return updates.length < MAX_ORDERED_LIST_LABEL_UPDATES ? true : STOP_PROSE_SCAN;
    }, MAX_ORDERED_LIST_LABEL_SCAN_NODES);

    return updates;
}

export function normalizeOrderedListLabels(state: EditorState): Transaction | null {
    let tr = state.tr;
    const updates = collectOrderedListLabelUpdates(state.doc);
    for (const update of updates) {
        tr = tr.setNodeMarkup(update.pos, undefined, update.attrs);
    }

    return updates.length > 0 ? tr.setMeta('addToHistory', false) : null;
}
