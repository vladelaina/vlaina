import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

export const debugPluginKey = new PluginKey('debug-cursor');

function serializeSliceToText(slice: any): string {
    let result = '';

    const processNode = (node: any) => {
        if (node.isText && node.text) {
            const linkMark = node.marks?.find((m: any) => m.type.name === 'link');
            if (linkMark) {
                result += '[' + node.text + '](' + linkMark.attrs.href + ')';
            } else {
                result += node.text;
            }
        } else if (node.type.name === 'hard_break') {
            result += '\n';
        }
    };

    slice.content.forEach((node: any) => {
        if (node.isTextblock) {
            node.content.forEach(processNode);
            result += '\n';
        } else {
            processNode(node);
        }
    });

    return result.replace(/\n+$/, '');
}

export const debugPlugin = $prose(() => {
    return new Plugin({
        key: debugPluginKey,
        props: {
            // 拦截复制事件，手动设置剪贴板内容
            handleDOMEvents: {
                copy(view, event) {
                    const { from, to } = view.state.selection;
                    if (from === to) return false; // 没有选择内容

                    const slice = view.state.doc.slice(from, to);
                    const text = serializeSliceToText(slice);

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