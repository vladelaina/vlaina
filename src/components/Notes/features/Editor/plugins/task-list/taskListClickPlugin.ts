import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

export const taskListClickPluginKey = new PluginKey('taskListClick');

export const taskListClickPlugin = $prose(() => {
    return new Plugin({
        key: taskListClickPluginKey,
        props: {
            handleDOMEvents: {
                mousedown(view, event) {
                    const target = event.target as HTMLElement;
                    if (!target) return false;
                    if (target.closest('a, button, input, textarea, select, [contenteditable="false"]')) return false;

                    const taskLi = target.closest('li[data-item-type="task"]') as HTMLElement;
                    if (!taskLi) return false;

                    const liRect = taskLi.getBoundingClientRect();
                    const clickX = event.clientX - liRect.left;
                    if (clickX > 5 || clickX < -30) return false;

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
