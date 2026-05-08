import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';

export const debugPluginKey = new PluginKey('debug-cursor');

export const debugPlugin = $prose(() => {
    return new Plugin({
        key: debugPluginKey,
        props: {
            // 拦截复制事件，手动设置剪贴板内容
            handleDOMEvents: {
                copy(view, event) {
                    const text = serializeSelectionToClipboardText(view.state);
                    if (text.length === 0) return false; // 没有选择内容

                    event.preventDefault();
                    event.clipboardData?.setData('text/plain', text);

                    return true;
                }
            }
        },
        state: {
            init() { },
            apply(tr, _value, _oldState) {
                if (!tr.selectionSet) return;

                return;
            }
        }
    });
});
