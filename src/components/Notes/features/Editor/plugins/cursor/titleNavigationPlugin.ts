import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { focusNoteTitleInputAtEnd } from '../../utils/titleInputDom';
import { shouldMoveSelectionToTitle } from './titleNavigationUtils';

export const titleNavigationPluginKey = new PluginKey('titleNavigation');

export const titleNavigationPlugin = $prose(() => {
    return new Plugin({
        key: titleNavigationPluginKey,
        props: {
            handleKeyDown(view, event) {
                if (
                    event.defaultPrevented ||
                    event.isComposing ||
                    event.key !== 'ArrowUp' ||
                    event.shiftKey ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey
                ) return false;
                if (!shouldMoveSelectionToTitle(view)) return false;
                if (!focusNoteTitleInputAtEnd()) return false;

                event.preventDefault();
                return true;
            },
        },
    });
});
