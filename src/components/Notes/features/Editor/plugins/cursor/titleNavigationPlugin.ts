import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

export const titleNavigationPluginKey = new PluginKey('titleNavigation');

function focusTitleInputAtEnd(): boolean {
    const input = document.querySelector<HTMLInputElement>('input[data-note-title-input="true"]');
    if (!input) return false;

    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
    return true;
}

function shouldMoveToTitle(view: EditorView): boolean {
    const { selection } = view.state;
    if (!selection?.empty) return false;

    // Must be inside the first top-level block.
    if (selection.$from?.index?.(0) !== 0) return false;

    // Respect visual line behavior: only jump when caret cannot move up anymore.
    if (typeof view.endOfTextblock === 'function' && !view.endOfTextblock('up')) return false;

    return true;
}

export const titleNavigationPlugin = $prose(() => {
    return new Plugin({
        key: titleNavigationPluginKey,
        props: {
            handleKeyDown(view, event) {
                if (event.key !== 'ArrowUp') return false;
                if (!shouldMoveToTitle(view)) return false;
                if (!focusTitleInputAtEnd()) return false;

                event.preventDefault();
                return true;
            },
        },
    });
});
