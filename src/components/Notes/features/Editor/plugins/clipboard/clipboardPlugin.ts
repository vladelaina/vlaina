import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { sanitizeHtml } from './sanitizer';
import { serializeSliceToText } from './serializer';

export const clipboardPluginKey = new PluginKey('neko-clipboard');

export const clipboardPlugin = $prose(() => {
    return new Plugin({
        key: clipboardPluginKey,
        props: {
            handleDOMEvents: {
                copy(view, event) {
                    const { from, to } = view.state.selection;
                    if (from === to) return false; // No selection

                    const slice = view.state.doc.slice(from, to);
                    const text = serializeSliceToText(slice);

                    // Manually set clipboard content
                    event.preventDefault();
                    event.clipboardData?.setData('text/plain', text);

                    return true; // Prevent default behavior
                }
            },
            // Intercept paste and sanitize HTML using our strict policy
            transformPastedHTML(html) {
                return sanitizeHtml(html);
            }
        }
    });
});
