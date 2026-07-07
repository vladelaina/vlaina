import { AllSelection, NodeSelection, Selection, TextSelection } from '@milkdown/kit/prose/state';
import { CellSelection } from '@milkdown/kit/prose/tables';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';

import { collapseSelectionAndHideFloatingToolbar } from './copyCleanup';

export function isClipboardCopyShortcut(event: KeyboardEvent): boolean {
    if (event.isComposing) return false;
    if (event.altKey) return false;

    const key = event.key.toLowerCase();
    return (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        (key === 'c' || key === 'insert')
    );
}

export function isClipboardCutShortcut(event: KeyboardEvent): boolean {
    if (event.isComposing) return false;
    if (event.altKey) return false;

    const key = event.key.toLowerCase();
    return (
        ((event.metaKey || event.ctrlKey) && !event.shiftKey && key === 'x') ||
        (!(event.metaKey || event.ctrlKey) && event.shiftKey && key === 'delete')
    );
}

function isNonEmptyTextSelection(selection: Selection): boolean {
    return (
        (selection instanceof TextSelection || selection.constructor?.name === 'TextSelection') &&
        !selection.empty
    );
}

export function shouldHandleCopyShortcutDirectly(selection: Selection): boolean {
    return (
        isNonEmptyTextSelection(selection) ||
        selection instanceof AllSelection ||
        selection instanceof CellSelection ||
        selection instanceof NodeSelection ||
        selection.constructor?.name === 'AllSelection' ||
        selection.constructor?.name === 'CellSelection' ||
        selection.constructor?.name === 'NodeSelection'
    );
}

export function shouldHandleCutShortcutDirectly(selection: Selection): boolean {
    return shouldHandleCopyShortcutDirectly(selection);
}

export function deleteCapturedSelection(view: EditorView, selection: Selection, doc: ProseNode): void {
    if (!view.state.doc.eq(doc)) {
        return;
    }

    view.dispatch(
        view.state.tr
            .setSelection(selection)
            .deleteSelection()
            .scrollIntoView(),
    );
    view.focus();
}

export function collapseCapturedSelectionAndHideFloatingToolbar(
    view: EditorView,
    selection: Selection,
    doc: ProseNode,
): void {
    if (!view.state.doc.eq(doc) || !selection.eq(view.state.selection)) {
        return;
    }

    collapseSelectionAndHideFloatingToolbar(view);
}
