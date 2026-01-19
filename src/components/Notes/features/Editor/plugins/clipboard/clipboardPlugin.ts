/**
 * Clipboard Plugin - 处理复制粘贴时的文本序列化
 * 
 * 解决问题：Milkdown 默认的复制行为会将空段落序列化为 <br /> HTML 标签
 * 解决方案：拦截复制事件，手动将内容序列化为纯净的文本格式
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

export const clipboardPluginKey = new PluginKey('neko-clipboard');

/**
 * 将 ProseMirror Slice 序列化为纯净的文本格式
 * 不包含任何 HTML 标签，只保留纯文本和换行符
 */
function serializeSliceToText(slice: any): string {
    let result = '';

    const processNode = (node: any) => {
        if (node.isText && node.text) {
            const linkMark = node.marks?.find((m: any) => m.type.name === 'link');
            if (linkMark) {
                // Check if it's an autolink (text matches href)
                // In this case, we prefer plain URL over [url](url) syntax
                if (node.text === linkMark.attrs.href) {
                    result += node.text;
                } else {
                    // Serialize regular links as Markdown
                    result += '[' + node.text + '](' + linkMark.attrs.href + ')';
                }
            } else {
                result += node.text;
            }
        } else if (node.type.name === 'hard_break') {
            // 将 hard_break 节点转换为换行符
            result += '\n';
        }
    };

    slice.content.forEach((node: any) => {
        if (node.isTextblock) {
            // 段落内的所有节点
            node.content.forEach(processNode);
            // 每个段落后添加换行
            result += '\n';
        } else {
            processNode(node);
        }
    });

    // 移除末尾多余的换行符
    return result.replace(/\n+$/, '');
}

export const clipboardPlugin = $prose(() => {
    return new Plugin({
        key: clipboardPluginKey,
        props: {
            handleDOMEvents: {
                copy(view, event) {
                    const { from, to } = view.state.selection;
                    if (from === to) return false; // 没有选择内容

                    const slice = view.state.doc.slice(from, to);
                    const text = serializeSliceToText(slice);

                    // 手动设置剪贴板内容
                    event.preventDefault();
                    event.clipboardData?.setData('text/plain', text);

                    return true; // 阻止默认行为
                }
            }
        }
    });
});
