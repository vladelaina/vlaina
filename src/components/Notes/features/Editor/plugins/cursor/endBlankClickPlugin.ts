import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { dispatchTailBlankClickAction, isClickBelowLastBlock } from './endBlankClickUtils';

export const endBlankClickPluginKey = new PluginKey('endBlankClick');

export const endBlankClickPlugin = $prose(() => {
    return new Plugin({
        key: endBlankClickPluginKey,
        props: {
            handleDOMEvents: {
                mousedown(view, event) {
                    if (!(event instanceof MouseEvent)) return false;
                    if (event.button !== 0) return false;
                    if (event.defaultPrevented) return false;
                    if (!(event.target instanceof HTMLElement)) return false;
                    if (!view.dom.contains(event.target)) return false;
                    if (event.target.closest('.heading-toggle-btn')) return false;
                    if (event.target !== view.dom) return false;
                    if (!isClickBelowLastBlock(view.dom, event.clientY)) return false;

                    const handled = dispatchTailBlankClickAction(view);
                    if (!handled) return false;

                    event.preventDefault();
                    return true;
                },
            },
        },
    });
});
