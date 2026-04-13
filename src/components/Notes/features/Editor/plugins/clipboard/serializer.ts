function escapeLinkText(text: string): string {
    return text.replace(/([[\]])/g, '\\$1');
}

function escapeLinkUrl(url: string): string {
    return url.replace(/([()])/g, '\\$1');
}

export function serializeSliceToText(slice: any): string {
    const processNode = (node: any): string => {
        if (node.isText && node.text) {
            const linkMark = node.marks?.find((m: any) => m.type.name === 'link');
            if (linkMark) {
                if (node.text === linkMark.attrs.href) {
                    return node.text;
                } else {
                    return '[' + escapeLinkText(node.text) + '](' + escapeLinkUrl(linkMark.attrs.href) + ')';
                }
            }
            return node.text;
        }

        if (node.type.name === 'hard_break') {
            return '\n';
        }

        if (node.type.name === 'hr') {
            return '---\n';
        }

        if (node.type.name === 'heading') {
            const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1));
            const content = serializeNodeContent(node).replace(/\n+$/, '');
            return '#'.repeat(level) + (content ? ' ' + content : '') + '\n';
        }

        if (node.type.name === 'code_block') {
            const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
            const content = serializeNodeContent(node).replace(/\n+$/, '');
            return '```' + language + '\n' + content + '\n```\n';
        }

        if (node.content && node.content.size > 0) {
            const content = serializeNodeContent(node);
            if (node.isBlock) {
                return content.endsWith('\n') ? content : content + '\n';
            }
            return content;
        }

        return '';
    };

    const serializeNodeContent = (node: any): string => {
        let content = '';
        node.content?.forEach((child: any) => {
            content += processNode(child);
        });
        return content;
    };

    let result = '';
    slice.content.forEach((node: any) => {
        result += processNode(node);
    });

    return result.replace(/\n+$/, '');
}
