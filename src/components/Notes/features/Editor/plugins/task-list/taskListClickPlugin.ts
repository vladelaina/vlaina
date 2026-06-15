import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { isTaskCheckboxClick } from './taskCheckboxHitArea';
import { markEditorUserInput } from '../shared/userInputEvents';

export const taskListClickPluginKey = new PluginKey('taskListClick');

function isPointVerticallyInsideTaskPrimaryLine(taskItem: HTMLElement, clientY: number): boolean {
    const textBlock = taskItem.querySelector(':scope > [data-text-align], :scope > p') as HTMLElement | null;
    const rect = (textBlock ?? taskItem).getBoundingClientRect();
    const slack = Math.max(4, Math.min(8, rect.height * 0.35));
    return clientY >= rect.top - slack && clientY <= rect.bottom + slack;
}

function compareDeepestFirst(a: HTMLElement, b: HTMLElement): number {
    if (a === b) return 0;
    if (a.contains(b)) return 1;
    if (b.contains(a)) return -1;
    return 0;
}

function resolveTaskCheckboxClickTarget(root: HTMLElement, target: HTMLElement, clientX: number, clientY: number): HTMLElement | null {
    const directTaskLi = target.closest('li[data-item-type="task"]') as HTMLElement | null;
    if (
        directTaskLi &&
        root.contains(directTaskLi) &&
        isPointVerticallyInsideTaskPrimaryLine(directTaskLi, clientY) &&
        isTaskCheckboxClick(directTaskLi, clientX)
    ) {
        return directTaskLi;
    }

    const scanRoot = target.closest('li') ?? root;
    const candidates = Array.from(scanRoot.querySelectorAll<HTMLElement>('li[data-item-type="task"]'))
        .filter((taskItem) => (
            isPointVerticallyInsideTaskPrimaryLine(taskItem, clientY) &&
            isTaskCheckboxClick(taskItem, clientX)
        ))
        .sort(compareDeepestFirst);

    return candidates[0] ?? null;
}

export const taskListClickPlugin = $prose(() => {
    return new Plugin({
        key: taskListClickPluginKey,
        props: {
            handleDOMEvents: {
                mousedown(view, event) {
                    const target = event.target as HTMLElement;
                    if (!target) return false;
                    if (target.closest('a, button, input, textarea, select, [contenteditable="false"]')) return false;

                    const taskLi = resolveTaskCheckboxClickTarget(view.dom, target, event.clientX, event.clientY);
                    if (!taskLi) return false;

                    event.preventDefault();

                    const posInNode = view.posAtDOM(taskLi, 0);
                    if (posInNode === null) return false;

                    const { state } = view;
                    const $pos = state.doc.resolve(posInNode);

                    for (let depth = $pos.depth; depth > 0; depth--) {
                        const node = $pos.node(depth);
                        if (node.type.name !== 'list_item') continue;
                        if (node.attrs.checked === undefined) continue;

                        const nodePos = $pos.before(depth);
                        const tr = state.tr.setNodeMarkup(nodePos, undefined, {
                            ...node.attrs,
                            checked: !node.attrs.checked,
                        });
                        markEditorUserInput(view);
                        view.dispatch(tr);
                        view.focus();
                        return true;
                    }

                    return false;
                },
            },
        },
    });
});
