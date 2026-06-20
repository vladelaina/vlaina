import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { resolveTaskCheckboxTarget } from './taskCheckboxHitArea';

const TASK_CHECKBOX_CURSOR_CLASS = 'editor-task-checkbox-hover';

export const taskListCursorPluginKey = new PluginKey('taskListCursor');

export const taskListCursorPlugin = $prose(() => {
    let isHoveringCheckbox = false;

    const setHoveringCheckbox = (root: HTMLElement, isHovering: boolean) => {
        if (isHoveringCheckbox === isHovering) return;
        isHoveringCheckbox = isHovering;
        root.classList.toggle(TASK_CHECKBOX_CURSOR_CLASS, isHovering);
    };

    return new Plugin({
        key: taskListCursorPluginKey,
        props: {
            handleDOMEvents: {
                mousemove(view, event) {
                    const target = event.target as HTMLElement | null;
                    const isHovering = Boolean(
                        target && resolveTaskCheckboxTarget(view.dom, target, event.clientX, event.clientY)
                    );
                    setHoveringCheckbox(view.dom, isHovering);
                    return false;
                },
                mouseleave(view) {
                    setHoveringCheckbox(view.dom, false);
                    return false;
                },
            },
        },
        view(view) {
            return {
                destroy() {
                    setHoveringCheckbox(view.dom, false);
                },
            };
        },
    });
});
